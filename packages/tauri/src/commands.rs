use tauri::State;

use crate::types::RpcCommand;
use crate::config_commands::AppState;

#[tauri::command]
pub async fn send_prompt(
    state: State<'_, AppState>,
    message: String,
    streaming_behavior: Option<String>,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    pi.send_prompt(&message, streaming_behavior.as_deref())
}

#[tauri::command]
pub async fn send_abort(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    pi.send_abort()
}

#[tauri::command]
pub async fn set_model(
    state: State<'_, AppState>,
    provider: String,
    model_id: String,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    pi.send_set_model(&provider, &model_id)
}

#[tauri::command]
pub async fn set_thinking_level(
    state: State<'_, AppState>,
    level: String,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    pi.send_command(&RpcCommand::SetThinkingLevel { level })
}

#[tauri::command]
pub async fn get_available_models(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    pi.send_command(&RpcCommand::GetAvailableModels)
}

#[tauri::command]
pub async fn new_session(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    pi.send_new_session()
}

#[tauri::command]
pub async fn extension_ui_response(
    state: State<'_, AppState>,
    id: String,
    value: Option<String>,
    confirmed: Option<bool>,
    cancelled: Option<bool>,
) -> Result<(), String> {
    let mut pi = state.pi.lock().await;
    let resp = crate::pi_rpc::ExtensionUIResponse {
        resp_type: "extension_ui_response".to_string(),
        id,
        value,
        confirmed,
        cancelled,
    };
    pi.send_extension_ui_response(&resp)
}

#[tauri::command]
pub async fn get_pi_state(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let cached = state.current_state.read().await;
    Ok(serde_json::json!({
        "is_streaming": cached.is_streaming,
        "message_count": cached.message_count,
        "is_connected": cached.is_connected,
        "session_id": cached.session_id,
    }))
}