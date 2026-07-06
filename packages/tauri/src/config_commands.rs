use crate::config;
use crate::pi_rpc::PiRpcManager;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub pi: Arc<Mutex<PiRpcManager>>,
}

// ── Provider commands ──

#[tauri::command]
pub fn get_providers() -> Result<Vec<config::ProviderSummary>, String> {
    Ok(config::get_provider_summaries())
}

#[tauri::command]
pub fn get_provider_status(provider: String) -> Result<serde_json::Value, String> {
    let auth = config::read_auth();
    let has_key = auth.contains_key(&provider);
    Ok(serde_json::json!({
        "provider": provider,
        "configured": has_key,
        "hasKey": has_key,
        "hasEnvVar": false,
    }))
}

#[tauri::command]
pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
    let mut auth = config::read_auth();
    auth.insert(provider, config::AuthEntry {
        auth_type: "api_key".to_string(),
        key,
        env: None,
    });
    config::write_auth(&auth)
}

#[tauri::command]
pub fn remove_api_key(provider: String) -> Result<(), String> {
    let mut auth = config::read_auth();
    auth.remove(&provider);
    config::write_auth(&auth)
}

#[tauri::command]
pub fn test_connection(provider: String) -> Result<serde_json::Value, String> {
    let auth = config::read_auth();
    let configured = auth.contains_key(&provider);
    Ok(serde_json::json!({
        "success": configured,
        "latencyMs": 0,
        "error": if configured { serde_json::Value::Null } else { serde_json::Value::String("No API key configured".to_string()) },
    }))
}

#[tauri::command]
pub fn get_endpoint(provider: String) -> Result<Option<serde_json::Value>, String> {
    let models = config::read_models();
    if let Some(pc) = models.providers.get(&provider) {
        Ok(Some(serde_json::json!({
            "baseUrl": pc.base_url,
            "api": pc.api,
        })))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn set_endpoint(provider: String, base_url: Option<String>, api: Option<String>) -> Result<(), String> {
    let mut models = config::read_models();
    let entry = models.providers.entry(provider).or_insert(config::ProviderConfig {
        name: None,
        base_url: None,
        api: None,
        models: vec![],
    });
    if let Some(url) = base_url { entry.base_url = Some(url); }
    if let Some(a) = api { entry.api = Some(a); }
    config::write_models(&models)
}

#[tauri::command]
pub fn remove_endpoint(provider: String) -> Result<(), String> {
    let mut models = config::read_models();
    models.providers.remove(&provider);
    config::write_models(&models)
}

#[tauri::command]
pub fn add_custom_provider(
    name: String,
    display_name: Option<String>,
    base_url: String,
    api: String,
    api_key: Option<String>,
    model_id: Option<String>,
    model_name: Option<String>,
) -> Result<(), String> {
    let mut models = config::read_models();
    let mut provider_models = vec![];
    if let Some(mid) = model_id {
        provider_models.push(config::ModelEntry {
            id: mid,
            name: model_name,
            context_window: None,
            max_tokens: None,
        });
    }
    models.providers.insert(name.clone(), config::ProviderConfig {
        name: display_name,
        base_url: Some(base_url),
        api: Some(api),
        models: provider_models,
    });
    config::write_models(&models)?;

    if let Some(key) = api_key {
        let mut auth = config::read_auth();
        auth.insert(name, config::AuthEntry {
            auth_type: "api_key".to_string(),
            key,
            env: None,
        });
        config::write_auth(&auth)?;
    }
    Ok(())
}

#[tauri::command]
pub fn add_custom_model(
    provider: String,
    base_url: Option<String>,
    api: Option<String>,
    model_id: String,
    model_name: Option<String>,
    context_window: Option<u32>,
) -> Result<(), String> {
    let mut models = config::read_models();
    let entry = models.providers.entry(provider).or_insert(config::ProviderConfig {
        name: None,
        base_url,
        api,
        models: vec![],
    });
    entry.models.push(config::ModelEntry {
        id: model_id,
        name: model_name,
        context_window,
        max_tokens: None,
    });
    config::write_models(&models)
}

#[tauri::command]
pub fn remove_custom_model(provider: String, model_id: String) -> Result<(), String> {
    let mut models = config::read_models();
    if let Some(provider_config) = models.providers.get_mut(&provider) {
        provider_config.models.retain(|m| m.id != model_id);
    }
    config::write_models(&models)
}

// ── Settings commands ──

#[tauri::command]
pub fn get_settings() -> Result<config::SettingsFile, String> {
    Ok(config::read_settings())
}

#[tauri::command]
pub fn set_default_model(provider: String, model_id: String, thinking_level: Option<String>) -> Result<(), String> {
    let mut settings = config::read_settings();
    settings.default_provider = Some(provider);
    settings.default_model = Some(model_id);
    if let Some(level) = thinking_level {
        settings.default_thinking_level = Some(level);
    }
    config::write_settings(&settings)
}

#[tauri::command]
pub fn set_enabled_models(patterns: Vec<String>) -> Result<(), String> {
    let mut settings = config::read_settings();
    settings.enabled_models = Some(patterns);
    config::write_settings(&settings)
}

// ── Model list ──

#[tauri::command]
pub fn get_models(available_only: bool) -> Result<Vec<config::ModelSummary>, String> {
    Ok(config::get_models(available_only))
}