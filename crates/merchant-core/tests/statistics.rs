use chrono::Utc;
use merchant_core::{competitor_statistics, Competitor, DecimalString, SCHEMA_VERSION};

fn competitor(id: &str, price: Option<&str>) -> Competitor {
    Competitor { schema_version: SCHEMA_VERSION, id: id.into(), product: id.into(), brand: String::new(), price: price.map(|value| DecimalString::parse(value).unwrap()), currency: "INR".into(), marketplace: String::new(), url: String::new(), source_id: None, notes: String::new(), observed_at: Utc::now() }
}

#[test]
fn calculates_even_median_and_average_with_decimal_rounding() {
    let competitors = vec![competitor("C-001", Some("100.00")), competitor("C-002", Some("200.00")), competitor("C-003", Some("400.00")), competitor("C-004", Some("900.00"))];
    let stats = competitor_statistics(&competitors);
    assert_eq!(stats.valid_price_count, 4);
    assert_eq!(stats.minimum.unwrap().file_string(), "100.00");
    assert_eq!(stats.maximum.unwrap().file_string(), "900.00");
    assert_eq!(stats.average.unwrap().file_string(), "400.00");
    assert_eq!(stats.median.unwrap().file_string(), "300.00");
}

#[test]
fn empty_prices_produce_none_not_zero() {
    let stats = competitor_statistics(&[competitor("C-001", None), competitor("C-002", None)]);
    assert_eq!(stats.valid_price_count, 0);
    assert!(stats.minimum.is_none());
    assert!(stats.average.is_none());
    assert!(stats.median.is_none());
}
