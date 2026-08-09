use chrono::Utc;
use merchant_core::{
    render_opportunity_report, CompetitorStatistics, CostAssumptions, EvidenceSource,
    ProjectManifest, ReportInput, ReportSections, SCHEMA_VERSION,
};
use uuid::Uuid;

#[test]
fn report_never_invents_empty_narrative() {
    let input = ReportInput {
        manifest: ProjectManifest {
            schema_version: SCHEMA_VERSION,
            project_id: Uuid::nil(),
            name: "Mechanical Keyboards India".into(),
            objective: "Assess demand".into(),
            currency: "INR".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        },
        sections: ReportSections::empty(),
        evidence: Vec::<EvidenceSource>::new(),
        competitor_statistics: CompetitorStatistics {
            valid_price_count: 0,
            minimum: None,
            maximum: None,
            average: None,
            median: None,
        },
        assumptions: CostAssumptions::empty("INR"),
        scenarios: vec![],
        run_id: "RUN-001".into(),
        generated_at: Utc::now(),
    };
    let markdown = render_opportunity_report(&input);
    assert!(markdown.contains("# Mechanical Keyboards India"));
    assert!(markdown.contains("## Research objective"));
    assert!(markdown.contains("No observations recorded."));
    assert!(markdown.contains("No risks recorded."));
    assert!(markdown.contains("No opportunities recorded."));
    assert!(markdown.contains("RUN-001"));
}
