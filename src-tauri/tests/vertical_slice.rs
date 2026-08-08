use chrono::Utc;
use merchant_core::{
    Competitor, CostAssumptions, DecimalString, EvidenceSource, ReportSections, ScenarioPrices,
    SCHEMA_VERSION,
};
use open_merchant_lib::application::{CreateProjectRequest, MerchantService, RecentProjectsStore};

#[test]
fn a_saved_project_reopens_with_its_research_economics_report_and_artifacts() {
    let temp = tempfile::tempdir().unwrap();
    let recents_path = temp.path().join("recents.json");
    let service = MerchantService::new(RecentProjectsStore::new(recents_path.clone()));
    let snapshot = service
        .create_project(CreateProjectRequest {
            parent_directory: temp.path().to_string_lossy().into_owned(),
            name: "Mechanical Keyboards India".into(),
            objective: "Assess whether mechanical keyboards are commercially attractive in India."
                .into(),
            currency: "INR".into(),
        })
        .unwrap();
    let now = Utc::now();
    let evidence = EvidenceSource {
        schema_version: SCHEMA_VERSION,
        id: "S-001".into(),
        url: "https://example.com/listing".into(),
        title: "Marketplace listing".into(),
        notes: "Observed mid-range board pricing.".into(),
        observations: vec![],
        observed_at: now,
        created_at: now,
        updated_at: now,
    };
    service
        .save_evidence(&snapshot.root, vec![evidence.clone()])
        .unwrap();
    service
        .save_competitors(
            &snapshot.root,
            vec![
                competitor("C-001", "3499", Some(evidence.id.clone()), now),
                competitor("C-002", "4499", Some(evidence.id.clone()), now),
            ],
        )
        .unwrap();
    service
        .save_assumptions(&snapshot.root, assumptions())
        .unwrap();
    service
        .save_report_sections(
            &snapshot.root,
            ReportSections {
                schema_version: SCHEMA_VERSION,
                decision_summary: "Worth validating with more supplier quotes.".into(),
                market_observations: vec!["Listings cluster around INR 3,500–4,500.".into()],
                risks: vec!["Pricing evidence is a small sample.".into()],
                opportunities: vec!["Target an entry-level enthusiast segment.".into()],
            },
        )
        .unwrap();

    let statistics = service.competitor_statistics(&snapshot.root).unwrap();
    assert_eq!(statistics.valid_price_count, 2);
    assert_eq!(statistics.median.unwrap().to_string(), "3999.00");
    assert_eq!(
        service
            .calculate_and_save_scenarios(&snapshot.root)
            .unwrap()
            .len(),
        3
    );
    let report = service.generate_report(&snapshot.root).unwrap();

    assert!(report.contains("Worth validating with more supplier quotes."));
    assert!(report.contains("[S-001] [Marketplace listing](https://example.com/listing)"));
    assert!(service
        .read_artifact(&snapshot.root, "economics/scenarios.csv")
        .unwrap()
        .contains("gross_margin_percent"));
    assert!(service
        .list_artifacts(&snapshot.root)
        .unwrap()
        .iter()
        .any(
            |artifact| artifact.relative_path == "reports/opportunity-report.md" && artifact.exists
        ));
    assert_eq!(service.list_runs(&snapshot.root).unwrap().len(), 1);
    assert_eq!(service.list_provenance(&snapshot.root).unwrap().len(), 2);

    let restarted_service = MerchantService::new(RecentProjectsStore::new(recents_path));
    assert_eq!(
        restarted_service
            .open_project(&snapshot.root)
            .unwrap()
            .manifest
            .objective,
        "Assess whether mechanical keyboards are commercially attractive in India."
    );
    assert_eq!(
        restarted_service.load_evidence(&snapshot.root).unwrap(),
        vec![evidence]
    );
    assert_eq!(
        restarted_service
            .load_competitors(&snapshot.root)
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        restarted_service.load_assumptions(&snapshot.root).unwrap(),
        assumptions()
    );
}

fn assumptions() -> CostAssumptions {
    CostAssumptions {
        schema_version: SCHEMA_VERSION,
        currency: "INR".into(),
        acquisition_cost: DecimalString::parse("1800").unwrap(),
        shipping_cost: DecimalString::parse("120").unwrap(),
        marketplace_fee_rate: DecimalString::parse("12").unwrap(),
        payment_fee_rate: DecimalString::parse("2").unwrap(),
        other_costs: DecimalString::parse("80").unwrap(),
        scenario_prices: ScenarioPrices {
            low: Some(DecimalString::parse("3000").unwrap()),
            base: Some(DecimalString::parse("4000").unwrap()),
            high: Some(DecimalString::parse("5000").unwrap()),
        },
    }
}

fn competitor(
    id: &str,
    price: &str,
    source_id: Option<String>,
    observed_at: chrono::DateTime<Utc>,
) -> Competitor {
    Competitor {
        schema_version: SCHEMA_VERSION,
        id: id.into(),
        product: "75% mechanical keyboard".into(),
        brand: "Example brand".into(),
        price: Some(DecimalString::parse(price).unwrap()),
        currency: "INR".into(),
        marketplace: "Example marketplace".into(),
        url: "https://example.com/listing".into(),
        source_id,
        notes: String::new(),
        observed_at,
    }
}
