use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tauri::Emitter;

mod commands;
mod config;
mod config_commands;
mod pi_rpc;
mod session_commands;
mod types;

fn main() {
    let pi = Arc::new(Mutex::new(pi_rpc::PiRpcManager::new()));
    let current_state = Arc::new(RwLock::new(config_commands::SessionState::default()));

    let state = config_commands::AppState {
        pi: pi.clone(),
        current_state: current_state.clone(),
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
            config_commands::get_settings,
            config_commands::set_default_model,
            config_commands::set_enabled_models,
            config_commands::get_models,
            session_commands::list_sessions,
            session_commands::switch_session,
            session_commands::get_session_messages,
            session_commands::list_files,
            session_commands::list_extensions,
        ])
        .setup(move |app| {
            // Migrate from .pi/agent to .juno/agent if needed
            migrate_pi_to_juno();

            let pi = pi.clone();
            let handle = app.handle().clone();
            let state = current_state.clone();

            tauri::async_runtime::spawn(async move {
                // Get event receiver FIRST, then spawn
                let mut rx = {
                    let mut pi_lock = pi.lock().await;
                    let rx = pi_lock.event_receiver();
                    if let Err(e) = pi_lock.spawn() {
                        eprintln!("Failed to start pi RPC: {}", e);
                        return;
                    }
                    // Mark as connected
                    let mut s = state.write().await;
                    s.is_connected = true;
                    drop(s);
                    rx
                };

                while let Some(line) = rx.recv().await {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
                        let event_type = val.get("type")
                            .and_then(|t| t.as_str())
                            .unwrap_or("event");

                        // Update cached state
                        let mut s = state.write().await;
                        match event_type {
                            "agent_start" => s.is_streaming = true,
                            "agent_end" => s.is_streaming = false,
                            "message_start" => s.message_count += 1,
                            "response" => {
                                if let Some(data) = val.get("data") {
                                    if let Some(msgs) = data.get("messageCount").and_then(|m| m.as_u64()) {
                                        s.message_count = msgs as u32;
                                    }
                                    if let Some(sid) = data.get("sessionId").and_then(|m| m.as_str()) {
                                        s.session_id = sid.to_string();
                                    }
                                }
                            }
                            _ => {}
                        }
                        drop(s);

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

fn migrate_pi_to_juno() {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    let pi_dir = std::path::PathBuf::from(&home).join(".pi").join("agent");
    let juno_dir = std::path::PathBuf::from(&home).join(".juno").join("agent");

    if !pi_dir.exists() || juno_dir.exists() { return; }

    eprintln!("Migrating ~/.pi/agent to ~/.juno/agent...");
    let _ = std::fs::create_dir_all(&juno_dir);

    let files = ["auth.json", "models.json", "settings.json"];
    for f in &files {
        let src = pi_dir.join(f);
        let dst = juno_dir.join(f);
        if src.exists() { let _ = std::fs::copy(&src, &dst); }
    }

    let pi_sessions = pi_dir.join("sessions");
    let juno_sessions = juno_dir.join("sessions");
    if pi_sessions.exists() {
        let _ = std::fs::create_dir_all(&juno_sessions);
        if let Ok(entries) = std::fs::read_dir(&pi_sessions) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                    let dst = juno_sessions.join(path.file_name().unwrap());
                    let _ = std::fs::copy(&path, &dst);
                }
            }
        }
    }
    eprintln!("Migration complete.");
}