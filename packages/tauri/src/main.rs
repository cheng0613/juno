use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tauri::Emitter;

mod commands;
mod pi_rpc;
mod types;

fn main() {
    let (event_tx, _event_rx) = mpsc::unbounded_channel::<String>();

    let pi = Arc::new(Mutex::new(pi_rpc::PiRpcManager::new()));

    let state = commands::AppState {
        pi: pi.clone(),
        event_tx,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::send_prompt,
            commands::send_abort,
            commands::set_model,
            commands::set_thinking_level,
            commands::get_available_models,
            commands::new_session,
            commands::extension_ui_response,
            commands::get_pi_state,
        ])
        .setup(move |app| {
            let pi = pi.clone();
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                // Start pi RPC process
                {
                    let mut pi_lock = pi.lock().await;
                    if let Err(e) = pi_lock.spawn() {
                        eprintln!("Failed to start pi RPC: {}", e);
                        return;
                    }
                }

                // Listen for events and emit them to the frontend
                let mut rx = {
                    let mut pi_lock = pi.lock().await;
                    pi_lock.event_receiver()
                };

                while let Some(line) = rx.recv().await {
                    // Try to parse and forward to frontend
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
                        // Determine event type and emit to webview
                        let event_type = val.get("type")
                            .and_then(|t| t.as_str())
                            .unwrap_or("event");
                        
                        let _ = handle.emit("pi-event", &val);
                        
                        // Handle extension UI requests
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