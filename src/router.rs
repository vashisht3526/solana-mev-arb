use crate::types::{ArbitrageOpportunity, DynamicPoolState};
use log::info;

pub const ATOMIC_ROUTER_PROGRAM_ID: &str = "AN225ksocfZpbPVEbwffiANbtUdYbySM3WJ6dbsYAqij";
pub const ORCA_WHIRLPOOL_PROGRAM_ID: &str = "DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH";
pub const METEORA_DLMM_PROGRAM_ID: &str = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
pub const RAYDIUM_CPMM_PROGRAM_ID: &str = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
pub const RAYDIUM_CLMM_PROGRAM_ID: &str = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
pub const PUMP_FUN_PROGRAM_ID: &str = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";

/// Simulated On-Chain Atomic Router Transaction Instruction
#[derive(Debug, Clone)]
pub struct AtomicSwapInstruction {
    pub program_id: String,
    pub leg1_dex: String,
    pub leg2_dex: String,
    pub amount_in_sol: f64,
    pub min_out_sol: f64,
    pub jito_tip_sol: f64,
    pub is_atomic_guaranteed: bool,
}

pub struct AtomicRouterEngine;

impl AtomicRouterEngine {
    /// Builds the atomic 2-leg CPI transaction bundle modeled after the $1.8M wallet
    pub fn build_atomic_bundle(opp: &ArbitrageOpportunity, buy_pool: &DynamicPoolState, sell_pool: &DynamicPoolState) -> AtomicSwapInstruction {
        let min_required_out_sol = opp.simulated_swap_sol + opp.net_profit_sol;
        
        info!(
            "⚡ [ATOMIC ROUTER CPI BUNDLE] Program: {} | Leg 1: BUY on {} ➔ Leg 2: SELL on {} | Size: {:.3} SOL ➔ Min Out: {:.4} SOL",
            &ATOMIC_ROUTER_PROGRAM_ID[0..8],
            buy_pool.dex,
            sell_pool.dex,
            opp.simulated_swap_sol,
            min_required_out_sol
        );

        AtomicSwapInstruction {
            program_id: ATOMIC_ROUTER_PROGRAM_ID.to_string(),
            leg1_dex: buy_pool.dex.clone(),
            leg2_dex: sell_pool.dex.clone(),
            amount_in_sol: opp.simulated_swap_sol,
            min_out_sol: min_required_out_sol,
            jito_tip_sol: opp.net_profit_sol * 0.25,
            is_atomic_guaranteed: true,
        }
    }
}
