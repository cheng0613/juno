use tauri::State;

use crate::config;
use crate::config_commands::AppState;

#[tauri::command]
pub fn list_sessions() -> Result<Vec<config::SessionInfo>, String> {
    Ok(config::list_sessions())
}

#[tauri::command]
pub async fn switch_session(
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    pi.send_command(&crate::types::RpcCommand::SwitchSession { session_path: path })
}

#[tauri::command]
pub async fn get_session_messages(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    pi.send_command(&crate::types::RpcCommand::GetMessages)
}

#[tauri::command]
pub fn list_files(query: String) -> Result<Vec<serde_json::Value>, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    let q = query.to_lowercase();

    if let Ok(entries) = std::fs::read_dir(&cwd) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if name.to_lowercase().contains(&q) {
                results.push(serde_json::json!({
                    "name": name,
                    "path": path.to_string_lossy(),
                    "is_dir": path.is_dir(),
                }));
            }
        }
    }

    if let Ok(entries) = std::fs::read_dir(&cwd) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(sub) = std::fs::read_dir(&path) {
                    for sub_entry in sub.flatten() {
                        let sub_path = sub_entry.path();
                        let name = sub_path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        let full_name = format!("{}/{}",
                            path.file_name().and_then(|n| n.to_str()).unwrap_or(""),
                            name
                        );
                        if name.to_lowercase().contains(&q) || full_name.to_lowercase().contains(&q) {
                            results.push(serde_json::json!({
                                "name": full_name,
                                "path": sub_path.to_string_lossy(),
                                "is_dir": false,
                            }));
                        }
                    }
                }
            }
        }
    }

    results.truncate(20);
    Ok(results)
}

#[tauri::command]
pub fn list_extensions() -> Result<Vec<config::ExtensionInfo>, String> {
    Ok(config::list_extensions())
}