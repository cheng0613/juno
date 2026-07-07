use std::collections::HashMap;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

// ── Auth (auth.json) ──

pub type AuthData = HashMap<String, AuthEntry>;

#[derive(Serialize, Deserialize, Clone)]
pub struct AuthEntry {
    #[serde(rename = "type")]
    pub auth_type: String,
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
}

// ── Models (models.json) ──

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ModelsFile {
    #[serde(default)]
    pub providers: HashMap<String, ProviderConfig>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api: Option<String>,
    #[serde(default)]
    pub models: Vec<ModelEntry>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ModelEntry {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
}

// ── Settings (settings.json) ──

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct SettingsFile {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_thinking_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled_models: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport: Option<String>,
}

// ── Built-in providers (hardcoded for display) ──

pub const BUILTIN_PROVIDERS: &[(&str, &str)] = &[
    ("anthropic", "Anthropic"),
    ("openai", "OpenAI"),
    ("deepseek", "DeepSeek"),
    ("google", "Google Gemini"),
    ("google-vertex", "Google Vertex"),
    ("amazon-bedrock", "Amazon Bedrock"),
    ("azure-openai-responses", "Azure OpenAI"),
    ("openai-codex", "OpenAI Codex"),
    ("github-copilot", "GitHub Copilot"),
    ("mistral", "Mistral"),
    ("groq", "Groq"),
    ("cerebras", "Cerebras"),
    ("openrouter", "OpenRouter"),
    ("xai", "xAI"),
    ("nvidia", "NVIDIA NIM"),
    ("minimax", "MiniMax"),
    ("minimax-cn", "MiniMax (China)"),
    ("moonshotai", "Moonshot AI"),
    ("kimi-coding", "Kimi For Coding"),
    ("huggingface", "Hugging Face"),
    ("fireworks", "Fireworks"),
    ("together", "Together AI"),
    ("vercel-ai-gateway", "Vercel AI Gateway"),
    ("cloudflare-workers-ai", "Cloudflare Workers AI"),
    ("cloudflare-ai-gateway", "Cloudflare AI Gateway"),
    ("zai", "ZAI Coding Plan"),
    ("zai-coding-cn", "ZAI Coding Plan (China)"),
    ("ant-ling", "Ant Ling"),
    ("xiaomi", "Xiaomi MiMo"),
    ("xiaomi-token-plan-cn", "Xiaomi Token Plan (China)"),
    ("xiaomi-token-plan-ams", "Xiaomi Token Plan (Amsterdam)"),
    ("xiaomi-token-plan-sgp", "Xiaomi Token Plan (Singapore)"),
    ("opencode", "OpenCode Zen"),
    ("opencode-go", "OpenCode Go"),
];

// ── File I/O ──

pub fn juno_agent_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".juno").join("agent")
}

pub fn read_json<T: for<'a> Deserialize<'a>>(path: &PathBuf) -> Result<T, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {:?}: {}", path, e))
}

pub fn write_json<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create dir {:?}: {}", parent, e))?;
    }
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(path, &content)
        .map_err(|e| format!("Failed to write {:?}: {}", path, e))
}

// Default file paths
pub fn auth_path() -> PathBuf { juno_agent_dir().join("auth.json") }
pub fn models_path() -> PathBuf { juno_agent_dir().join("models.json") }
pub fn settings_path() -> PathBuf { juno_agent_dir().join("settings.json") }
pub fn sessions_dir() -> PathBuf { juno_agent_dir().join("sessions") }

// ── Session listing ──

#[derive(Serialize, Clone)]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub message_count: u32,
    pub timestamp: u64,
}

pub fn list_sessions() -> Vec<SessionInfo> {
    let dir = sessions_dir();
    if !dir.exists() { return vec![]; }

    let mut sessions = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") { continue; }

            // Read first line (header) for metadata
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Some(first_line) = content.lines().next() {
                    if let Ok(header) = serde_json::from_str::<serde_json::Value>(first_line) {
                        let info = &header["sessionInfo"];
                        let id = info.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let name = info.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let ts = info.get("timestamp").and_then(|v| v.as_u64()).unwrap_or(0);
                        let msg_count = content.lines().count().saturating_sub(1) as u32;

                        sessions.push(SessionInfo {
                            id,
                            name: if name.is_empty() { path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string() } else { name },
                            path: path.to_string_lossy().to_string(),
                            message_count: msg_count,
                            timestamp: ts,
                        });
                    }
                }
            }
        }
    }
    sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    sessions
}

// ── Convenience readers/writers ──

pub fn read_auth() -> AuthData {
    read_json(&auth_path()).unwrap_or_default()
}

pub fn write_auth(auth: &AuthData) -> Result<(), String> {
    write_json(&auth_path(), auth)
}

pub fn read_models() -> ModelsFile {
    read_json(&models_path()).unwrap_or_default()
}

pub fn write_models(models: &ModelsFile) -> Result<(), String> {
    write_json(&models_path(), models)
}

pub fn read_settings() -> SettingsFile {
    read_json(&settings_path()).unwrap_or_default()
}

pub fn write_settings(settings: &SettingsFile) -> Result<(), String> {
    write_json(&settings_path(), settings)
}

// ── Provider summary for frontend ──

#[derive(Serialize, Clone)]
pub struct ProviderSummary {
    pub name: String,
    pub display_name: String,
    pub auth_status: String,
    pub credential_type: Option<String>,
    pub model_count: usize,
    pub available_model_count: usize,
}

pub fn get_provider_summaries() -> Vec<ProviderSummary> {
    let auth = read_auth();
    let models = read_models();

    let mut result: Vec<ProviderSummary> = BUILTIN_PROVIDERS.iter().map(|(name, display)| {
        let auth_status = if auth.contains_key(*name) { "configured" } else { "not_configured" };
        let credential_type = auth.get(*name).map(|e| e.auth_type.clone());
        let model_count = models.providers.get(*name)
            .map(|p| p.models.len() + 1) // +1 for built-in
            .unwrap_or(1);
        ProviderSummary {
            name: name.to_string(),
            display_name: display.to_string(),
            auth_status: auth_status.to_string(),
            credential_type,
            model_count,
            available_model_count: if auth_status == "configured" { model_count } else { 0 },
        }
    }).collect();

    // Add custom providers (in models.json but not in built-in list)
    for (name, config) in &models.providers {
        if !BUILTIN_PROVIDERS.iter().any(|(n, _)| n == name) {
            let auth_status = if auth.contains_key(name) { "configured" } else { "not_configured" };
            result.push(ProviderSummary {
                name: name.clone(),
                display_name: config.name.clone().unwrap_or_else(|| name.clone()),
                auth_status: auth_status.to_string(),
                credential_type: auth.get(name).map(|e| e.auth_type.clone()),
                model_count: config.models.len(),
                available_model_count: if auth_status == "configured" { config.models.len() } else { 0 },
            });
        }
    }

    result
}

#[derive(Serialize, Clone)]
pub struct ModelSummary {
    pub id: String,
    pub name: Option<String>,
    pub provider: String,
    pub context_window: u32,
    pub reasoning: bool,
    pub is_custom: bool,
}

pub fn get_models(available_only: bool) -> Vec<ModelSummary> {
    let auth = read_auth();
    let models = read_models();
    let settings = read_settings();
    let mut result = Vec::new();

    for (name, _display) in BUILTIN_PROVIDERS {
        let configured = auth.contains_key(*name);
        if available_only && !configured { continue; }

        // Built-in model placeholder
        result.push(ModelSummary {
            id: format!("{}-model", name),
            name: Some(format!("{} (built-in)", _display)),
            provider: name.to_string(),
            context_window: 128000,
            reasoning: true,
            is_custom: false,
        });

        // Custom models from models.json
        if let Some(provider_config) = models.providers.get(*name) {
            for model in &provider_config.models {
                result.push(ModelSummary {
                    id: model.id.clone(),
                    name: model.name.clone(),
                    provider: name.to_string(),
                    context_window: model.context_window.unwrap_or(128000),
                    reasoning: true,
                    is_custom: true,
                });
            }
        }
    }

    // Custom providers
    for (name, config) in &models.providers {
        if !BUILTIN_PROVIDERS.iter().any(|(n, _)| n == name) {
            let configured = auth.contains_key(name);
            if available_only && !configured { continue; }
            for model in &config.models {
                result.push(ModelSummary {
                    id: model.id.clone(),
                    name: model.name.clone(),
                    provider: name.clone(),
                    context_window: model.context_window.unwrap_or(128000),
                    reasoning: true,
                    is_custom: true,
                });
            }
        }
    }

    // Mark default
    if let (Some(dp), Some(dm)) = (&settings.default_provider, &settings.default_model) {
        for m in &mut result {
            if m.provider == *dp && (m.id == *dm || m.name.as_deref() == Some(dm)) {
                // We'll handle default marking differently
            }
        }
    }

    result
}

// ── Extensions & Skills listing ──

#[derive(Serialize, Clone)]
pub struct ExtensionInfo {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub description: String,
}

pub fn list_extensions() -> Vec<ExtensionInfo> {
    let mut items = Vec::new();
    let base = juno_agent_dir();

    let ext_dir = base.join("extensions");
    if ext_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&ext_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("ts") {
                    let name = path.file_stem().and_then(|n| n.to_str()).unwrap_or("").to_string();
                    items.push(ExtensionInfo {
                        name,
                        path: path.to_string_lossy().to_string(),
                        kind: "extension".to_string(),
                        description: String::new(),
                    });
                }
            }
        }
    }

    let skills_dir = base.join("skills");
    if skills_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let skill_md = path.join("SKILL.md");
                    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                    let description = if skill_md.exists() {
                        if let Ok(content) = std::fs::read_to_string(&skill_md) {
                            content.lines().next().unwrap_or("").to_string()
                        } else { String::new() }
                    } else { String::new() };
                    items.push(ExtensionInfo {
                        name,
                        path: skill_md.to_string_lossy().to_string(),
                        kind: "skill".to_string(),
                        description,
                    });
                }
            }
        }
    }

    items
}