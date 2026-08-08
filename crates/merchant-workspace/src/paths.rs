use std::path::{Path, PathBuf};

pub const MANIFEST: &str = "merchant-project.json";
pub const SOURCES: &str = "sources/sources.jsonl";
pub const COMPETITORS: &str = "market/competitors.csv";
pub const ASSUMPTIONS: &str = "economics/assumptions.json";
pub const SCENARIOS: &str = "economics/scenarios.csv";
pub const REPORT_SECTIONS: &str = "reports/report-sections.json";
pub const OPPORTUNITY_REPORT: &str = "reports/opportunity-report.md";
pub const RUNS: &str = ".merchant/runs.jsonl";
pub const PROVENANCE: &str = ".merchant/provenance.jsonl";

pub const ALL_ARTIFACTS: [&str; 9] = [
    MANIFEST,
    SOURCES,
    COMPETITORS,
    ASSUMPTIONS,
    SCENARIOS,
    REPORT_SECTIONS,
    OPPORTUNITY_REPORT,
    RUNS,
    PROVENANCE,
];

pub fn at(root: &Path, relative: &str) -> PathBuf {
    root.join(relative)
}
