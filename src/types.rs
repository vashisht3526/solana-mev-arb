use serde::{Deserialize, Serialize};

/// Supported Decentralized Exchanges
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DexType {
    PumpSwap,
    RaydiumCpmm,
    RaydiumClmm,
    MeteoraDlmm,
    OrcaWhirlpool,
}

impl DexType {
    pub fn from_str_loose(s: &str) -> Option<Self> {
        let s_lower = s.to_lowercase();
        if s_lower.contains("pump") {
            Some(DexType::PumpSwap)
        } else if s_lower.contains("raydium") || s_lower.contains("cpmm") {
            Some(DexType::RaydiumCpmm)
        } else if s_lower.contains("clmm") {
            Some(DexType::RaydiumClmm)
        } else if s_lower.contains("meteora") || s_lower.contains("dlmm") {
            Some(DexType::MeteoraDlmm)
        } else if s_lower.contains("orca") || s_lower.contains("whirlpool") {
            Some(DexType::OrcaWhirlpool)
        } else {
            None
        }
    }

    pub fn to_display(&self) -> &'static str {
        match self {
            DexType::PumpSwap => "PUMPSWAP",
            DexType::RaydiumCpmm => "RAYDIUM",
            DexType::RaydiumClmm => "RAYDIUM_CLMM",
            DexType::MeteoraDlmm => "METEORA",
            DexType::OrcaWhirlpool => "ORCA",
        }
    }
}

/// Dynamic in-memory pool state across DEXes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicPoolState {
    pub mint: String,
    pub dex: String, // "PUMPSWAP", "RAYDIUM", "METEORA", "ORCA"
    pub pool_address: String,
    pub price_usd: f64,
    pub liquidity_usd: f64,
    pub last_update_ms: i64,
    pub is_active: bool,
}

/// Token registered in the dynamic volatile tracking registry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolatileTrackedToken {
    pub mint: String,
    pub symbol: String,
    pub name: String,
    pub market_cap_usd: f64,
    pub volume_5m_usd: f64,
    pub total_liquidity_usd: f64,
    pub volatility_score: f64, // (5m_vol / liq) * 100
    pub pools: Vec<DynamicPoolState>,
    pub added_timestamp_ms: i64,
    pub last_spread_pct: f64,
    pub consecutive_flat_ticks: u32,
}

/// Arbitrage opportunity candidate evaluated in RAM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageOpportunity {
    pub timestamp_ms: i64,
    pub iso_time: String,
    pub mint: String,
    pub symbol: String,
    pub name: String,
    pub target_dex: String,
    pub pair_address: String,
    pub pump_price_usd: f64,
    pub raydium_price_usd: f64,
    pub gross_spread_pct: f64,
    pub net_spread_pct: f64,
    pub pool_liquidity_usd: f64,
    pub simulated_swap_sol: f64,
    pub gross_profit_usd: f64,
    pub jito_tip_usd: f64,
    pub net_profit_usd: f64,
    pub net_profit_sol: f64,
}

/// Mainnet Shadow Paper-Trading execution record written to NDJSON
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperTradeRecord {
    pub trade_id: String,
    pub timestamp_ms: i64,
    pub iso_time: String,
    pub mint: String,
    pub symbol: String,
    pub position_size_sol: f64,
    pub entry_pump_price_usd: f64,
    pub exit_raydium_price_usd: f64,
    pub gross_spread_pct: f64,
    pub net_spread_pct: f64,
    pub gas_fee_sol: f64,
    pub jito_tip_sol: f64,
    pub net_pnl_sol: f64,
    pub net_pnl_usd: f64,
    pub starting_wallet_balance_sol: f64,
    pub ending_wallet_balance_sol: f64,
    pub status: String, // "FILLED", "FAILED_FRONT_RUN", "FAILED_STALE_QUOTE", etc.
}
