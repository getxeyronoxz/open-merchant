use crate::ReportInput;

pub fn render_opportunity_report(input: &ReportInput) -> String {
    let mut markdown = format!(
        "# {}\n\nGenerated: {}\n\n## Research objective\n\n{}\n\n## Decision summary\n\n{}\n\n",
        input.manifest.name,
        input.generated_at.to_rfc3339(),
        input.manifest.objective,
        empty(
            &input.sections.decision_summary,
            "No decision summary recorded."
        )
    );
    section(
        &mut markdown,
        "Market observations",
        &input.sections.market_observations,
        "No observations recorded.",
    );
    markdown.push_str("## Pricing and unit economics\n\n");
    if input.scenarios.is_empty() {
        markdown.push_str("No scenarios calculated.\n\n");
    } else {
        markdown.push_str("| Scenario | Price | Total cost | Gross profit | Margin |\n|---|---:|---:|---:|---:|\n");
        for scenario in &input.scenarios {
            markdown.push_str(&format!(
                "| {:?} | {} {} | {} | {} | {}% |\n",
                scenario.scenario,
                input.manifest.currency,
                scenario.selling_price,
                scenario.total_cost,
                scenario.gross_profit,
                scenario.gross_margin_percent
            ));
        }
        markdown.push('\n');
    }
    section(
        &mut markdown,
        "Risks",
        &input.sections.risks,
        "No risks recorded.",
    );
    section(
        &mut markdown,
        "Opportunities",
        &input.sections.opportunities,
        "No opportunities recorded.",
    );
    markdown.push_str("## Evidence index\n\n");
    if input.evidence.is_empty() {
        markdown.push_str("No evidence recorded.\n\n");
    } else {
        for source in &input.evidence {
            markdown.push_str(&format!(
                "- [{}] [{}]({})\n",
                source.id, source.title, source.url
            ));
        }
        markdown.push('\n');
    }
    markdown.push_str(&format!("---\nGenerating run: {}\n", input.run_id));
    markdown
}
fn empty<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    if value.trim().is_empty() {
        fallback
    } else {
        value
    }
}
fn section(markdown: &mut String, title: &str, items: &[String], fallback: &str) {
    markdown.push_str(&format!("## {title}\n\n"));
    if items.is_empty() {
        markdown.push_str(fallback);
        markdown.push_str("\n\n");
    } else {
        for item in items {
            markdown.push_str(&format!("- {item}\n"));
        }
        markdown.push('\n');
    }
}
