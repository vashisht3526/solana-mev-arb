use crate::math::solve_optimal_arbitrage_newton;
use crate::types::{ArbitrageOpportunity, DynamicPoolState};
use chrono::Utc;

pub const BASE_GAS_FEE_SOL: f64 = 0.000005;
pub const PRIORITY_FEE_SOL: f64 = 0.00010; // Scaled for 110k CU target

/// Dynamic Jito tip based on market conditions (25% of net margin, clamped [0.00005, 0.01])
fn calculate_dynamic_jito_tip(expected_profit_sol: f64) -> f64 {
    let base_tip_pct = 0.25;
    let min_tip_sol = 0.00005;
    let max_tip_sol = 0.01;

    let calculated_tip = expected_profit_sol * base_tip_pct;
    calculated_tip.clamp(min_tip_sol, max_tip_sol)
}

/// Derive CPMM reserves from USD liquidity and USD price
fn derive_pool_reserves(pool: &DynamicPoolState, sol_price_usd: f64) -> Option<(f64, f64, f64)> {
    if pool.liquidity_usd <= 0.0 || pool.price_usd <= 0.0 || sol_price_usd <= 0.0 {
        return None;
    }

    let r_sol = (pool.liquidity_usd / 2.0) / sol_price_usd;
    let r_tok = (pool.liquidity_usd / 2.0) / pool.price_usd;

    let fee_multiplier = match pool.dex.to_lowercase().as_str() {
        "pump" | "pumpswap" | "pump.fun" => 0.990, // 1.0%
        "raydium" | "raydium_clmm" => 0.9975,       // 0.25%
        "meteora" => 0.999,                        // 0.10%
        _ => 0.997,                                // 0.30%
    };

    Some((r_sol, r_tok, fee_multiplier))
}

/// Evaluate optimal cross-DEX spatial arbitrage using Newton-Raphson
pub fn evaluate_optimal_arbitrage(
    mint: &str,
    symbol: &str,
    pool_a: &DynamicPoolState,
    pool_b: &DynamicPoolState,
    sol_price_usd: f64,
    min_net_profit_sol: f64,
    max_position_sol: f64,
    min_spread_pct: f64,
) -> Option<ArbitrageOpportunity> {
    if !pool_a.is_active || !pool_b.is_active {
        return None;
    }

    const MIN_LIQUIDITY_USD: f64 = 100.0;
    if pool_a.liquidity_usd < MIN_LIQUIDITY_USD || pool_b.liquidity_usd < MIN_LIQUIDITY_USD {
        return None;
    }

    // Determine cheaper pool (we buy from) and expensive pool (we sell to)
    let (buy_pool, sell_pool) = if pool_a.price_usd < pool_b.price_usd {
        (pool_a, pool_b)
    } else {
        (pool_b, pool_a)
    };

    let (r_sol_buy, r_tok_buy, gamma_buy) = derive_pool_reserves(buy_pool, sol_price_usd)?;
    let (r_sol_sell, r_tok_sell, gamma_sell) = derive_pool_reserves(sell_pool, sol_price_usd)?;

    // Calculate price difference and spread
    let price_diff = sell_pool.price_usd - buy_pool.price_usd;
    if price_diff <= 0.0 {
        return None;
    }
    let gross_spread_pct = (price_diff / buy_pool.price_usd) * 100.0;

    const MAX_SPREAD_PCT: f64 = 15.00;
    if gross_spread_pct < min_spread_pct || gross_spread_pct > MAX_SPREAD_PCT {
        return None;
    }

    // Solve for optimal arbitrage size in SOL via Newton-Raphson
    let optimal_input_sol = solve_optimal_arbitrage_newton(
        r_sol_buy,
        r_tok_buy,
        gamma_buy,
        r_sol_sell,
        r_tok_sell,
        gamma_sell,
        50,
        1e-9,
    )?;

    // Dynamic position sizing based on bankroll limits
    let min_position_sol = (max_position_sol * 0.15).max(0.015);
    let pool_safe_cap = r_sol_buy * 0.10; // Max 10% of pool reserves
    let final_swap_sol = optimal_input_sol.min(pool_safe_cap).min(max_position_sol);

    if final_swap_sol < min_position_sol {
        return None;
    }

    // Exact output calculation
    // Leg 1: Buy tokens on Pool A
    let effective_in_sol = final_swap_sol * gamma_buy;
    let tokens_out = (r_tok_buy * effective_in_sol) / (r_sol_buy + effective_in_sol);
    if tokens_out <= 0.0 {
        return None;
    }

    // Leg 2: Sell tokens on Pool B
    let effective_in_tok = tokens_out * gamma_sell;
    let sol_received = (r_sol_sell * effective_in_tok) / (r_tok_sell + effective_in_tok);
    if sol_received <= final_swap_sol {
        return None;
    }

    let gross_profit_sol = sol_received - final_swap_sol;
    let total_gas_sol = BASE_GAS_FEE_SOL + PRIORITY_FEE_SOL;
    if gross_profit_sol <= total_gas_sol {
        return None;
    }

    let jito_tip_sol = calculate_dynamic_jito_tip(gross_profit_sol - total_gas_sol);
    let net_profit_sol = gross_profit_sol - total_gas_sol - jito_tip_sol;

    if net_profit_sol < min_net_profit_sol {
        return None;
    }

    let net_spread_pct = (net_profit_sol / final_swap_sol) * 100.0;
    let gross_profit_usd = gross_profit_sol * sol_price_usd;
    let jito_tip_usd = jito_tip_sol * sol_price_usd;
    let net_profit_usd = net_profit_sol * sol_price_usd;

    let now = Utc::now();

    Some(ArbitrageOpportunity {
        timestamp_ms: now.timestamp_millis(),
        iso_time: now.to_rfc3339(),
        mint: mint.to_string(),
        symbol: symbol.to_string(),
        name: format!("{}/SOL", symbol),
        target_dex: sell_pool.dex.clone(),
        pair_address: sell_pool.pool_address.clone(),
        pump_price_usd: buy_pool.price_usd,
        raydium_price_usd: sell_pool.price_usd,
        gross_spread_pct: (gross_spread_pct * 100.0).round() / 100.0,
        net_spread_pct: (net_spread_pct * 100.0).round() / 100.0,
        pool_liquidity_usd: buy_pool.liquidity_usd.min(sell_pool.liquidity_usd),
        simulated_swap_sol: (final_swap_sol * 1000.0).round() / 1000.0,
        gross_profit_usd: (gross_profit_usd * 100.0).round() / 100.0,
        jito_tip_usd: (jito_tip_usd * 100.0).round() / 100.0,
        net_profit_usd: (net_profit_usd * 100.0).round() / 100.0,
        net_profit_sol: (net_profit_sol * 10000.0).round() / 10000.0,
    })
}