use open_merchant_lib::application::{CreateProjectRequest, MerchantService, RecentProjectsStore};

#[test]
fn creating_and_opening_projects_updates_recent_paths() {
    let temp = tempfile::tempdir().unwrap();
    let recents = RecentProjectsStore::new(temp.path().join("recent-projects.json"));
    let service = MerchantService::new(recents);

    let snapshot = service
        .create_project(CreateProjectRequest {
            parent_directory: temp.path().to_string_lossy().into_owned(),
            name: "Mechanical Keyboards India".into(),
            objective: "Assess the India opportunity".into(),
            currency: "INR".into(),
        })
        .unwrap();

    assert_eq!(service.list_recent_projects().unwrap()[0].path, snapshot.root);
    assert_eq!(
        service.open_project(&snapshot.root).unwrap().manifest.name,
        snapshot.manifest.name
    );
}

#[test]
fn removing_a_recent_project_does_not_delete_its_workspace() {
    let temp = tempfile::tempdir().unwrap();
    let recents = RecentProjectsStore::new(temp.path().join("recent-projects.json"));
    let service = MerchantService::new(recents);
    let snapshot = service
        .create_project(CreateProjectRequest {
            parent_directory: temp.path().to_string_lossy().into_owned(),
            name: "Mechanical Keyboards India".into(),
            objective: "Assess the India opportunity".into(),
            currency: "INR".into(),
        })
        .unwrap();

    service.remove_recent_project(&snapshot.root).unwrap();

    assert!(service.list_recent_projects().unwrap().is_empty());
    assert!(std::path::Path::new(&snapshot.root).is_dir());
}
