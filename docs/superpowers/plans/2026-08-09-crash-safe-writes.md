# Crash-Safe Workspace Writes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Preserve the last valid local project or recent-projects file when a replacement write fails on Windows.

**Architecture:** Keep callers responsible for serialization and their existing error types. Move durable write-and-replace logic into \`merchant-workspace\`: write and sync a unique same-folder temporary file, then use Windows replacement APIs without deleting the destination. The recent-projects store calls that shared primitive.

**Tech Stack:** Rust 2021, \`std::fs\`, \`uuid\`, target-specific \`windows-sys\` Win32 filesystem bindings, and existing \`thiserror\` errors.

## Global Constraints

- Preserve user-owned local project files; never delete a destination before its replacement succeeds.
- Keep Windows API details inside workspace storage; retain a portable non-Windows fallback.
- Reuse one atomic writer for workspace artifacts and the recent-projects store.
- Use a unique temporary filename in the destination directory and call \`sync_all\` before replacement.
- Do not change workspace JSON, CSV, JSONL, Markdown, or provenance schemas.
- Do not push branches or create a PR in this task.

---

### Task 1: Define the failed-replacement safety contract

**Files:**
- Modify: \`crates/merchant-workspace/src/atomic.rs\`
- Test: \`crates/merchant-workspace/src/atomic.rs\`

**Interfaces:**
- Produces private \`write_with_replacement(path: &Path, contents: &[u8], replace: impl FnOnce(&Path, &Path) -> io::Result<()>) -> io::Result<()>\`.

- [x] **Step 1: Write the failing test**

~~~rust
#[test]
fn failed_replacement_preserves_the_last_valid_file() {
    let directory = tempfile::tempdir().unwrap();
    let destination = directory.path().join("merchant-project.json");
    fs::write(&destination, b"last valid state").unwrap();

    let error = write_with_replacement(&destination, b"new state", |_, _| {
        Err(io::Error::other("simulated replacement interruption"))
    })
    .unwrap_err();

    assert_eq!(error.kind(), io::ErrorKind::Other);
    assert_eq!(fs::read(&destination).unwrap(), b"last valid state");
}
~~~

- [x] **Step 2: Run test to verify it fails**

Run: \`cargo test -p merchant-workspace failed_replacement_preserves_the_last_valid_file\`

Expected: FAIL because \`write_with_replacement\` does not exist.

- [x] **Step 3: Commit the red test only**

~~~text
git add crates/merchant-workspace/src/atomic.rs
git commit -m "test: cover interrupted workspace writes"
~~~

### Task 2: Implement a durable replacement primitive

**Files:**
- Modify: \`crates/merchant-workspace/Cargo.toml\`
- Modify: \`crates/merchant-workspace/src/atomic.rs\`
- Modify: \`crates/merchant-workspace/src/lib.rs\`
- Test: \`crates/merchant-workspace/src/atomic.rs\`

**Interfaces:**
- Produces \`pub fn write_file_atomically(path: &Path, contents: &[u8]) -> io::Result<()>\`.
- Produces private \`replace_temporary_file(temporary: &Path, destination: &Path) -> io::Result<()>\`.

- [x] **Step 1: Implement temporary-file creation and flush**

~~~rust
pub fn write_file_atomically(path: &Path, contents: &[u8]) -> io::Result<()> {
    write_with_replacement(path, contents, replace_temporary_file)
}

fn write_with_replacement(
    path: &Path,
    contents: &[u8],
    replace: impl FnOnce(&Path, &Path) -> io::Result<()>,
) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| io::Error::new(
        io::ErrorKind::InvalidInput,
        "file has no parent directory",
    ))?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!(".{}.{}.tmp", file_name(path)?, Uuid::new_v4()));
    let mut file = OpenOptions::new().create_new(true).write(true).open(&temporary)?;
    file.write_all(contents)?;
    file.sync_all()?;
    drop(file);

    let result = replace(&temporary, path);
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}
~~~

- [x] **Step 2: Add platform-specific replacement**

~~~rust
#[cfg(windows)]
fn replace_temporary_file(temporary: &Path, destination: &Path) -> io::Result<()> {
    if destination.exists() {
        replace_file_write_through(destination, temporary)
    } else {
        move_file_write_through(temporary, destination)
    }
}

#[cfg(not(windows))]
fn replace_temporary_file(temporary: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(temporary, destination)
}
~~~

Add a target-specific \`windows-sys\` dependency with \`Win32_Foundation\` and \`Win32_Storage_FileSystem\`. Convert paths to null-terminated UTF-16. Use \`ReplaceFileW\` with \`REPLACEFILE_WRITE_THROUGH\` for an existing destination and \`MoveFileExW\` with \`MOVEFILE_WRITE_THROUGH\` for a missing destination. If either returns zero, return \`io::Error::last_os_error()\`.

- [x] **Step 3: Preserve the existing workspace adapter**

Keep private \`atomic::write\` as the adapter that maps \`write_file_atomically\` failures to \`WorkspaceError::Io\` with the destination path. Re-export \`write_file_atomically\` from \`merchant-workspace::lib\` for the application store.

- [x] **Step 4: Verify green**

Run: \`cargo test -p merchant-workspace failed_replacement_preserves_the_last_valid_file\`

Expected: PASS and the destination remains \`last valid state\`.

Run: \`cargo test -p merchant-workspace\`

Expected: PASS.

- [x] **Step 5: Commit the implementation**

~~~text
git add crates/merchant-workspace/Cargo.toml crates/merchant-workspace/src/atomic.rs crates/merchant-workspace/src/lib.rs
git commit -m "fix: replace project files safely"
~~~

### Task 3: Protect the recent-projects store with the shared primitive

**Files:**
- Modify: \`src-tauri/src/application/recent_projects.rs\`
- Test: \`src-tauri/src/application/recent_projects.rs\`

**Interfaces:**
- Consumes: \`merchant_workspace::write_file_atomically\`.
- Produces private \`RecentProjectsStore::save_with(projects: &[RecentProject], write: impl FnOnce(&Path, &[u8]) -> io::Result<()>) -> Result<(), AppError>\`.

- [x] **Step 1: Write the failing module test**

~~~rust
#[test]
fn failed_recent_project_replacement_preserves_existing_json() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("recents.json");
    fs::write(&path, r#"[{"name":"Saved","path":"C:\\Saved","lastOpenedAt":"2026-08-09T00:00:00Z"}]"#).unwrap();
    let store = RecentProjectsStore::new(&path);

    let result = store.save_with(&[], |_, _| {
        Err(io::Error::other("simulated replacement interruption"))
    });

    assert!(matches!(result, Err(AppError::Io { .. })));
    assert!(fs::read_to_string(path).unwrap().contains("Saved"));
}
~~~

- [x] **Step 2: Run test to verify it fails**

Run: \`cargo test -p open-merchant failed_recent_project_replacement_preserves_existing_json\`

Expected: FAIL because \`save_with\` does not exist.

- [x] **Step 3: Use the shared writer**

~~~rust
fn save(&self, projects: &[RecentProject]) -> Result<(), AppError> {
    self.save_with(projects, write_file_atomically)
}

fn save_with(
    &self,
    projects: &[RecentProject],
    write: impl FnOnce(&Path, &[u8]) -> io::Result<()>,
) -> Result<(), AppError> {
    // Retain the existing parent-directory and JSON serialization checks.
    let contents = serde_json::to_vec_pretty(projects).map_err(|source| AppError::Json {
        path: self.path.clone(),
        source,
    })?;
    write(&self.path, &contents).map_err(|source| AppError::Io {
        path: self.path.clone(),
        source,
    })
}
~~~

The production \`save\` must have no delete-then-rename code. The test-only closure is local to the private module method and does not expose a second production write strategy.

- [x] **Step 4: Verify green**

Run: \`cargo test -p open-merchant failed_recent_project_replacement_preserves_existing_json\`

Expected: PASS and prior \`recents.json\` bytes remain readable.

Run: \`cargo test --workspace --all-targets\`

Expected: PASS.

- [x] **Step 5: Commit the application integration**

~~~text
git add src-tauri/src/application/recent_projects.rs
git commit -m "test: verify failed replacement preserves recents"
~~~

### Task 4: Verify the Windows release path

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes the completed shared writer and the already-regenerated logo assets.
- Produces a Windows NSIS installer built from the full local branch.

- [x] **Step 1: Run formatting and linting**

Run: \`cargo fmt --all -- --check; cargo clippy --workspace --all-targets --all-features -- -D warnings\`

Expected: both commands exit successfully.

- [x] **Step 2: Run frontend verification**

Run: \`npm run test:run; npm run build\`

Expected: 10 frontend tests pass and Vite produces \`dist/\`.

- [x] **Step 3: Build the NSIS installer**

Run: \`npm run tauri build -- --bundles nsis\`

Expected: an NSIS installer at \`target/release/bundle/nsis/Open Merchant_0.1.0_x64-setup.exe\`.

- [x] **Step 4: Record installer identity and final state**

Run: \`Get-FileHash -Algorithm SHA256 target/release/bundle/nsis/Open Merchant_0.1.0_x64-setup.exe; git diff --check; git status --short --branch\`

Expected: a SHA-256 value, no whitespace errors, and no uncommitted product changes.
