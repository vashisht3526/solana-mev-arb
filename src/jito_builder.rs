use log::{error, info};
use reqwest::Client;
use serde_json::json;
use std::sync::Arc;

const JITO_TIP_PUBKEY: &str = "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";
const JITO_BLOCK_ENGINE_URL: &str = "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles";

pub struct JitoBuilder {
    client: Client,
}

impl JitoBuilder {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn simulate_or_send_bundle(
        &self,
        encoded_tx: &str,
    ) -> anyhow::Result<bool> {
        let body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendBundle",
            "params": [[encoded_tx]]
        });

        let resp = self.client
            .post(JITO_BLOCK_ENGINE_URL)
            .json(&body)
            .send()
            .await?;

        if resp.status().is_success() {
            info!("⚡ Jito bundle submitted successfully to Frankfurt Block Engine");
            Ok(true)
        } else {
            error!("❌ Jito bundle rejected: status {}", resp.status());
            Ok(false)
        }
    }
}
