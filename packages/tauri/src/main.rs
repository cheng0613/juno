use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Emitter;

mod commands;
mod config;
mod config_commands;
mod pi_rpc;
mod types;

fn main() {
    let pi = Arc::new(Mutex::new(pi_rpc::PiRpcManager::new()));

    let state = config_commands::AppState {
        pi: pi.clone(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Chat / RPC commands
            commands::send_prompt,
            commands::send_abort,
            commands::set_model,
            commands::set_thinking_level,
            commands::get_available_models,
            commands::new_session,
            commands::extension_ui_response,
            commands::get_pi_state,
            // Provider commands
            config_commands::get_providers,
            config_commands::get_provider_status,
            config_commands::set_api_key,
            config_commands::remove_api_key,
            config_commands::test_connection,
            config_commands::get_endpoint,
            config_commands::set_endpoint,
            config_commands::remove_endpoint,
            config_commands::add_custom_provider,
            config_commands::add_custom_model,
            config_commands::remove_custom_model,
            // Settings commands
            config_commands::get_settings,
            config_commands::set_default_model,
            config_commands::set_enabled_models,
            config_commands::get_models,
        ])
        .setup(move |app| {
            let pi = pi.clone();
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                {
                    let mut pi_lock = pi.lock().await;
                    if let Err(e) = pi_lock.spawn() {
                        eprintln!("Failed to start pi RPC: {}", e);
                        return;
                    }
                }

                let mut rx = {
                    let mut pi_lock = pi.lock().await;
                    pi_lock.event_receiver()
                };

                while let Some(line) = rx.recv().await {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
                        let event_type = val.get("type")
                            .and_then(|t| t.as_str())
                            .unwrap_or("event");

                        let _ = handle.emit("pi-event", &val);

                        if event_type == "extension_ui_request" {
                            let _ = handle.emit("pi-extension-ui", &val);
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}