use chrono::Utc;
use merchant_core::{Competitor, DecimalString, SCHEMA_VERSION};
use merchant_workspace::Workspace;

#[test]
fn competitor_csv_preserves_money_unicode_commas_and_quotes() {
    let temp = tempfile::tempdir().unwrap();
    let workspace = Workspace::create(temp.path(), "Keyboard Study", "Assess demand", "INR").unwrap();
    let competitors = vec![Competitor {
        schema_version: SCHEMA_VERSION,
        id: "C-001".into(),
        product: "K2, hot-swappable".into(),
        brand: "Keychron".into(),
        price: Some(DecimalString::parse("7499.00").unwrap()),
        currency: "INR".into(),
        marketplace: "Brand store".into(),
        url: "https://example.com/k2".into(),
        source_id: Some("S-001".into()),
        notes: "Includes “Mac” keycaps".into(),
        observed_at: Utc::now(),
    }];

    workspace.save_competitors(&competitors).unwrap();

    assert_eq!(workspace.load_competitors().unwrap(), competitors);
}
