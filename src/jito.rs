/// Jito Block Engine Endpoints for direct validator leader co-location
pub const JITO_BLOCK_ENGINE_FRANKFURT: &str = "https://frankfurt.mainnet.block-engine.jito.wtf";
pub const JITO_BLOCK_ENGINE_AMSTERDAM: &str = "https://amsterdam.mainnet.block-engine.jito.wtf";
pub const JITO_BLOCK_ENGINE_TOKYO: &str = "https://tokyo.mainnet.block-engine.jito.wtf";
pub const JITO_BLOCK_ENGINE_NY: &str = "https://ny.mainnet.block-engine.jito.wtf";

/// Public Jito Validator Tip Accounts
pub const JITO_TIP_ACCOUNTS: &[&str] = &[
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
];

pub struct JitoBundleOptimizer;

impl JitoBundleOptimizer {
    /// Calculate optimal validator tip lamports based on expected gross profit
    /// Bids between 40% and 75% of profit depending on competition margin
    pub fn calculate_dynamic_tip_lamports(gross_profit_sol: f64) -> u64 {
        if gross_profit_sol <= 0.0 {
            return 10_000; // Minimum 0.00001 SOL base tip
        }

        let profit_lamports = (gross_profit_sol * 1e9) as u64;
        let tip_ratio = if gross_profit_sol > 0.05 {
            0.65 // Bid 65% on large arbs to guarantee inclusion
        } else {
            0.50 // Bid 50% on standard micro-arbs
        };

        let calculated_tip = (profit_lamports as f64 * tip_ratio) as u64;
        calculated_tip.max(10_000).min(profit_lamports.saturating_sub(10_000))
    }

    /// Select optimal Jito tip account
    pub fn get_tip_account(index_hint: usize) -> &'static str {
        JITO_TIP_ACCOUNTS[index_hint % JITO_TIP_ACCOUNTS.len()]
    }
}
