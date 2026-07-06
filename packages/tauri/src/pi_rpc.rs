use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tokio::sync::mpsc;

use crate::types::*;

pub struct PiRpcManager {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    event_tx: Option<mpsc::UnboundedSender<String>>,
    shutdown: Arc<AtomicBool>,
}

impl PiRpcManager {
    pub fn new() -> Self {
        PiRpcManager {
            child: None,
            stdin: None,
            event_tx: None,
            shutdown: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn event_receiver(&mut self) -> mpsc::UnboundedReceiver<String> {
        let (tx, rx) = mpsc::unbounded_channel();
        self.event_tx = Some(tx);
        rx
    }

    pub fn spawn(&mut self) -> Result<(), String> {
        let bin_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin");

        // Try standalone pi binary first (no Node.js needed)
        let pi_binary = bin_dir.join("pi.exe");
        let use_binary = pi_binary.exists();

        let (cmd, args) = if use_binary {
            (pi_binary.to_string_lossy().to_string(), vec!["--mode".to_string(), "rpc".to_string()])
        } else {
            let wrapper_path = bin_dir.join("pi-rpc.cjs");
            if !wrapper_path.exists() {
                return Err(format!("Neither pi.exe nor pi-rpc.cjs found in {:?}", bin_dir));
            }
            let node = find_node().ok_or("Node.js not found in PATH (and no pi.exe available)")?;
            (node, vec![wrapper_path.to_string_lossy().to_string()])
        };

        let mut child = Command::new(&cmd)
            .args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn pi RPC: {}", e))?;

        let stdin = child.stdin.take()
            .ok_or("Failed to open pi stdin")?;
        let stdout = child.stdout.take()
            .ok_or("Failed to open pi stdout")?;

        self.child = Some(child);
        self.stdin = Some(stdin);
        self.shutdown.store(false, Ordering::SeqCst);

        // Clone event_tx for reader thread
        let event_tx = self.event_tx.clone()
            .ok_or("event_receiver() must be called before spawn()")?;

        // Spawn reader thread
        let shutdown = self.shutdown.clone();
        let reader = BufReader::new(stdout);
        
        thread::spawn(move || {
            for line in reader.lines() {
                if shutdown.load(Ordering::SeqCst) {
                    break;
                }
                match line {
                    Ok(text) => {
                        if !text.trim().is_empty() {
                            let _ = event_tx.send(text);
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(())
    }

    pub fn send_command(&mut self, cmd: &RpcCommand) -> Result<(), String> {
        let json = serde_json::to_string(cmd)
            .map_err(|e| format!("Serialize error: {}", e))?;
        
        if let Some(ref mut stdin) = self.stdin {
            writeln!(stdin, "{}", json)
                .map_err(|e| format!("Write error: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Flush error: {}", e))?;
            Ok(())
        } else {
            Err("pi process not started".to_string())
        }
    }

    pub fn send_prompt(&mut self, message: &str, streaming_behavior: Option<&str>) -> Result<(), String> {
        self.send_command(&RpcCommand::Prompt {
            id: Some(uuid::Uuid::new_v4().to_string()),
            message: message.to_string(),
            images: None,
            streaming_behavior: streaming_behavior.map(|s| s.to_string()),
        })
    }

    pub fn send_abort(&mut self) -> Result<(), String> {
        self.send_command(&RpcCommand::Abort)
    }

    pub fn send_set_model(&mut self, provider: &str, model_id: &str) -> Result<(), String> {
        self.send_command(&RpcCommand::SetModel {
            provider: provider.to_string(),
            model_id: model_id.to_string(),
        })
    }

    pub fn send_new_session(&mut self) -> Result<(), String> {
        self.send_command(&RpcCommand::NewSession)
    }

    pub fn send_extension_ui_response(&mut self, response: &ExtensionUIResponse) -> Result<(), String> {
        let cmd = serde_json::to_value(response)
            .map_err(|e| e.to_string())?;
        let json = serde_json::to_string(&cmd)
            .map_err(|e| e.to_string())?;
        
        if let Some(ref mut stdin) = self.stdin {
            writeln!(stdin, "{}", json)
                .map_err(|e| format!("Write error: {}", e))?;
            stdin.flush()
                .map_err(|e| format!("Flush error: {}", e))?;
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn is_running(&mut self) -> bool {
        if let Some(ref mut child) = self.child {
            match child.try_wait() {
                Ok(None) => true,
                _ => false,
            }
        } else {
            false
        }
    }

    pub fn shutdown(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
        if let Some(ref mut child) = self.child {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for PiRpcManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn find_node() -> Option<String> {
    // Check common locations
    for path in &["node", "node.exe"] {
        if let Ok(p) = std::env::var("PATH") {
            for dir in std::env::split_paths(&p) {
                let full = dir.join(path);
                if full.exists() {
                    return Some(full.to_string_lossy().to_string());
                }
            }
        }
    }
    // Fallback: just try "node"
    Some("node".to_string())
}

// ── Types for Extension UI responses ──

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ExtensionUIResponse {
    #[serde(rename = "type")]
    pub resp_type: String,
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled: Option<bool>,
}