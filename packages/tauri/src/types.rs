#![allow(dead_code)]
use serde::{Deserialize, Serialize};

// ── Commands sent to pi --mode rpc ──

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RpcCommand {
    #[serde(rename = "prompt")]
    Prompt {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        images: Option<Vec<ImageContent>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        streaming_behavior: Option<String>,
    },
    #[serde(rename = "abort")]
    Abort,
    #[serde(rename = "new_session")]
    NewSession,
    #[serde(rename = "get_state")]
    GetState {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    #[serde(rename = "get_messages")]
    GetMessages,
    #[serde(rename = "set_model")]
    SetModel {
        provider: String,
        #[serde(rename = "modelId")]
        model_id: String,
    },
    #[serde(rename = "set_thinking_level")]
    SetThinkingLevel { level: String },
    #[serde(rename = "get_available_models")]
    GetAvailableModels,
    #[serde(rename = "compact")]
    Compact,
    #[serde(rename = "bash")]
    Bash { command: String },
    #[serde(rename = "extension_ui_response")]
    ExtensionUiResponse {
        id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        value: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        confirmed: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        cancelled: Option<bool>,
    },
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ImageContent {
    #[serde(rename = "type")]
    pub content_type: String,
    pub data: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
}

// ── Responses from pi --mode rpc ──

#[derive(Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum RpcOutput {
    Response(RpcResponse),
    Event(RpcEvent),
    ExtensionUI(ExtensionUIRequest),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RpcResponse {
    #[serde(rename = "type")]
    pub resp_type: String,
    pub command: Option<String>,
    pub success: bool,
    pub error: Option<String>,
    pub data: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum RpcEvent {
    #[serde(rename = "agent_start")]
    AgentStart,
    #[serde(rename = "agent_end")]
    AgentEnd { messages: Option<Vec<serde_json::Value>> },
    #[serde(rename = "turn_start")]
    TurnStart,
    #[serde(rename = "turn_end")]
    TurnEnd { message: Option<serde_json::Value>, tool_results: Option<Vec<serde_json::Value>> },
    #[serde(rename = "message_start")]
    MessageStart { message: serde_json::Value },
    #[serde(rename = "message_update")]
    MessageUpdate { message: serde_json::Value, assistant_message_event: serde_json::Value },
    #[serde(rename = "message_end")]
    MessageEnd { message: serde_json::Value },
    #[serde(rename = "tool_execution_start")]
    ToolExecutionStart {
        tool_call_id: String,
        tool_name: String,
        args: Option<serde_json::Value>,
    },
    #[serde(rename = "tool_execution_update")]
    ToolExecutionUpdate {
        tool_call_id: String,
        tool_name: String,
        partial_result: Option<serde_json::Value>,
    },
    #[serde(rename = "tool_execution_end")]
    ToolExecutionEnd {
        tool_call_id: String,
        tool_name: String,
        result: Option<serde_json::Value>,
        is_error: Option<bool>,
    },
    #[serde(rename = "queue_update")]
    QueueUpdate { steering: Option<Vec<String>>, follow_up: Option<Vec<String>> },
    #[serde(rename = "compaction_start")]
    CompactionStart { reason: String },
    #[serde(rename = "compaction_end")]
    CompactionEnd { reason: String, result: Option<serde_json::Value> },
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExtensionUIRequest {
    #[serde(rename = "type")]
    pub req_type: String,
    pub id: String,
    pub method: String,
    pub title: Option<String>,
    pub message: Option<String>,
    pub options: Option<Vec<String>>,
    pub placeholder: Option<String>,
    pub prefill: Option<String>,
    pub timeout: Option<u64>,
    pub notify_type: Option<String>,
    pub status_key: Option<String>,
    pub status_text: Option<String>,
}

// ── State summary returned to frontend ──

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionState {
    pub model: Option<ModelInfo>,
    pub thinking_level: String,
    pub is_streaming: bool,
    pub session_id: String,
    pub message_count: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub context_window: u32,
    pub reasoning: bool,
}