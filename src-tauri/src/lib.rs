pub mod application;
mod commands;

use application::{MerchantService, RecentProjectsStore};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
            app.manage(MerchantService::new(RecentProjectsStore::new(
                data_dir.join("recent-projects.json"),
            )));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_project,
            commands::open_project,
            commands::save_manifest,
            commands::load_evidence,
            commands::save_evidence,
            commands::load_competitors,
            commands::save_competitors,
            commands::competitor_statistics,
            commands::load_assumptions,
            commands::save_assumptions,
            commands::calculate_and_save_scenarios,
            commands::generate_report,
            commands::save_report_sections,
            commands::list_recent_projects,
            commands::remove_recent_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Merchant");
}
