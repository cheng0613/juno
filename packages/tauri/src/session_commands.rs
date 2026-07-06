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