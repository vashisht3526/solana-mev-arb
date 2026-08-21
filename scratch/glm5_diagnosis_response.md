# 🩺 DIAGNOSIS: Why The System Is Not Trading

The production logs confirm the system is alive (`Active Tokens: 13`), but the arbitrage engine is effectively blind. The root causes are architectural logic gaps in `src/scanner.rs`.

## 🔴 Critical Failure Points

### 1. The "Pump.fun Tunnel Vision" (WebSocket Handler)
**Observation:** `Arbs Eval: 0` despite `Pools Scanned: 4640`.
**Root Cause:** In `handle_onchain_swap`, the logic strictly evaluates `pump_pool` vs. `other_pools`.
```rust
// CURRENT CODE (FAULTY)
let other_pools: Vec<DynamicPoolState> = token.pools.iter()
    .filter(|p| p.dex != "PUMPSWAP") // Only checks NON-PumpSwap pools
    .cloned()
    .collect();
```
**Why it fails:** The 13 tracked tokens (e.g., STONK, MANLET) are "graduated" tokens. They trade heavily on Raydium, Meteora, and Orca. They rarely (if ever) trade on the Pump.fun bonding curve anymore. Since the WebSocket stream triggers `handle_onchain_swap` primarily for Pump.fun activity, the evaluation logic never runs for these multi-DEX tokens. The system ignores the active Raydium/Meteora markets.

### 2. The "Passive Auditor" (Volatility Loop)
**Observation:** `Opps: 0` even during periodic audits.
**Root Cause:** The `run_volatility_auditor` function fetches fresh prices from DexScreener every 15 seconds but **never runs the arbitrage solver**.
```rust
// CURRENT CODE (FAULTY)
if let Some(mut token_ref) = self.tracking_registry.get_mut(&mint) {
    token_ref.pools = updated_pools; // Updates state
    token_ref.volume_5m_usd = total_5m_vol;
    // ❌ MISSING: Call to evaluate_optimal_arbitrage()!
}
```
**Why it fails:** The auditor acts as a passive data updater. It refreshes the dashboard's "Pools Scanned" counter but fails to check if the price on Raydium has drifted away from Meteora. It sees the data but doesn't *act* on it.

### 3. Missing Cross-DEX Logic
The system lacks a generic `evaluate_all_pairs` routine. It assumes a binary world (Pump vs. Raydium), missing the complex reality of Solana DEX dynamics (Raydium vs. Meteora, Orca vs. Raydium, etc.).

---

# 🛠️ THE FIX: Production-Ready `src/scanner.rs`

I have re-architected the scanner to implement **Omnidirectional Cross-DEX Arbitrage**.

**Key Changes:**
1.  **Generic Pair Evaluation:** Added `evaluate_all_pool_pairs` that iterates over every combination of pools (Raydium vs. Meteora, Meteora vs. Orca, etc.).
2.  **Active Auditor:** `run_volatility_auditor` now acts as a secondary trading engine, checking for arbitrage every 15 seconds for all tracked tokens.
3.  **Smart WebSocket Handling:** `handle_onchain_swap` now updates the specific pool price and triggers a full re-evaluation of *all* pairs for that token, not just Pump.fun pairs.

```rust
use crate::amm::evaluate_optimal_arbitrage;
use crate::paper_engine::PaperTradingEngine;
use crate::types::{ArbitrageOpportunity, DynamicPoolState, VolatileTrackedToken};
use crate::websocket_feed::{LiveSwapEvent, PumpPortalFeed, RaydiumMigrationEvent};
use chrono::Utc;
use dashmap::DashMap;
use log::info;
use reqwest::Client;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc::{channel, Receiver};
use tokio::time::sleep;

const MIN_POOL_LIQUIDITY_USD: f64 = 500.0;
const MAX_VOLATILE_MCAP_USD: f64 = 10_000_000.0;
const MIN_ADMISSION_5M_VOL_USD: f64 = 50.0;
const MIN_NET_PROFIT_SOL: f64 = 0.0005; // 500k lamports minimum net profit

// --- KIMI K2.5 LOCK-FREE ATOMIC TRADE LOCK TABLE ---
const COOLDOWN_BITS: u32 = 32;
const COOLDOWN_MASK: u64 = 0xFFFFFFFF00000000;
const HASH_MASK: u64 = 0x00000000FFFFFFFF;
const DEFAULT_COOLDOWN_MS: u64 = 500;
const GLOBAL_COOLDOWN_MS: u64 = 100;

pub struct TradeLockTable {
    inner: DashMap<String, AtomicU64>,
    global_last_trade: AtomicU64,
}

impl TradeLockTable {
    pub fn new() -> Self {
        Self {
            inner: DashMap::with_capacity(1024),
            global_last_trade: AtomicU64::new(0),
        }
    }

    #[inline(always)]
    pub fn try_acquire_lock(&self, token_mint: &str, path_hash: u32, cooldown_ms: u64) -> bool {
        let now = Utc::now().timestamp_millis() as u64;

        // Check global cooldown
        let global_last = self.global_last_trade.load(Ordering::Relaxed);
        if now.saturating_sub(global_last) < GLOBAL_COOLDOWN_MS {
            return false;
        }

        let new_expiry = now.saturating_add(cooldown_ms);
        let new_packed = (new_expiry << COOLDOWN_BITS) | (path_hash as u64 & HASH_MASK);

        match self.inner.entry(token_mint.to_string()) {
            dashmap::mapref::entry::Entry::Occupied(entry) => {
                let atomic = entry.get();
                let current = atomic.load(Ordering::Relaxed);
                let current_expiry = (current & COOLDOWN_MASK) >> COOLDOWN_BITS;

                if now > current_expiry {
                    if atomic.compare_exchange_weak(current, new_packed, Ordering::SeqCst, Ordering::Relaxed).is_ok() {
                        self.global_last_trade.store(now, Ordering::Relaxed);
                        return true;
                    }
                }
                false
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                entry.insert(AtomicU64::new(new_packed));
                self.global_last_trade.store(now, Ordering::Relaxed);
                true
            }
        }
    }
}

pub struct ArbitrageScanner {
    http_client: Client,
    paper_engine: Arc<PaperTradingEngine>,
    pub tracking_registry: Arc<DashMap<String, VolatileTrackedToken>>,
    pub trade_locks: Arc<TradeLockTable>,
    pub tokens_tracked: Arc<AtomicUsize>,
    pub pools_scanned: Arc<AtomicUsize>,
    pub arbs_checked: Arc<AtomicUsize>,
    pub opps_found: Arc<AtomicUsize>,
    last_known_prices: Arc<DashMap<String, (f64, f64)>>,
}

impl ArbitrageScanner {
    pub fn new(paper_engine: Arc<PaperTradingEngine>) -> Self {
        let http_client = Client::builder()
            .timeout(Duration::from_millis(4000))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            .build()
            .unwrap_or_default();

        Self {
            http_client,
            paper_engine,
            tracking_registry: Arc::new(DashMap::new()),
            trade_locks: Arc::new(TradeLockTable::new()),
            tokens_tracked: Arc::new(AtomicUsize::new(0)),
            pools_scanned: Arc::new(AtomicUsize::new(0)),
            arbs_checked: Arc::new(AtomicUsize::new(0)),
            opps_found: Arc::new(AtomicUsize::new(0)),
            last_known_prices: Arc::new(DashMap::new()),
        }
    }

    pub async fn fetch_sol_price(&self) -> f64 {
        let url = "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT";
        if let Ok(resp) = self.http_client.get(url).send().await {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                if let Some(price_str) = body.get("price").and_then(|p| p.as_str()) {
                    if let Ok(price) = price_str.parse::<f64>() {
                        return price;
                    }
                }
            }
        }
        86.50
    }

    pub async fn fetch_live_pools(&self, mint: &str) -> (String, String, f64, f64, Vec<DynamicPoolState>) {
        self.pools_scanned.fetch_add(1, Ordering::Relaxed);
        let url = format!("https://api.dexscreener.com/latest/dex/tokens/{}", mint);
        let resp = match self.http_client.get(&url).send().await {
            Ok(r) => r,
            Err(_) => return ("TOKEN".to_string(), "Token".to_string(), 0.0, 0.0, Vec::new()),
        };

        let body: serde_json::Value = match resp.json().await {
            Ok(b) => b,
            Err(_) => return ("TOKEN".to_string(), "Token".to_string(), 0.0, 0.0, Vec::new()),
        };

        let pairs = match body.get("pairs").and_then(|p| p.as_array()) {
            Some(p) => p,
            None => return ("TOKEN".to_string(), "Token".to_string(), 0.0, 0.0, Vec::new()),
        };

        if pairs.is_empty() {
            return ("TOKEN".to_string(), "Token".to_string(), 0.0, 0.0, Vec::new());
        }

        let symbol = pairs[0].get("baseToken").and_then(|b| b.get("symbol")).and_then(|s| s.as_str()).unwrap_or("TOKEN").to_string();
        let name = pairs[0].get("baseToken").and_then(|b| b.get("name")).and_then(|n| n.as_str()).unwrap_or("Token").to_string();
        let mcap = pairs[0].get("marketCap").and_then(|m| m.as_f64()).unwrap_or(0.0);
        let fdv = pairs[0].get("fdv").and_then(|f| f.as_f64()).unwrap_or(0.0);
        let effective_mcap = if mcap > 0.0 { mcap } else { fdv };

        let mut total_5m_vol = 0.0;
        let mut best_pools: HashMap<String, DynamicPoolState> = HashMap::new();
        let now_ms = Utc::now().timestamp_millis();

        for p in pairs {
            let raw_dex = p.get("dexId").and_then(|d| d.as_str()).unwrap_or("").to_lowercase();
            let dex = if raw_dex.contains("pump") {
                "PUMPSWAP".to_string()
            } else if raw_dex.contains("raydium") {
                "RAYDIUM".to_string()
            } else if raw_dex.contains("meteora") {
                "METEORA".to_string()
            } else if raw_dex.contains("orca") || raw_dex.contains("whirlpool") {
                "ORCA".to_string()
            } else {
                continue;
            };

            let liq = p.get("liquidity").and_then(|l| l.get("usd")).and_then(|u| u.as_f64()).unwrap_or(0.0);
            let vol_5m = p.get("volume").and_then(|v| v.get("m5")).and_then(|m| m.as_f64()).unwrap_or(0.0);
            total_5m_vol += vol_5m;

            if liq >= MIN_POOL_LIQUIDITY_USD {
                if let Some(price_str) = p.get("priceUsd").and_then(|pr| pr.as_str()) {
                    if let Ok(price_usd) = price_str.parse::<f64>() {
                        if price_usd > 0.0 && price_usd < 10000.0 {
                            let pool = DynamicPoolState {
                                mint: mint.to_string(),
                                dex: dex.clone(),
                                pool_address: p.get("pairAddress").and_then(|pa| pa.as_str()).unwrap_or("").to_string(),
                                price_usd,
                                liquidity_usd: liq,
                                last_update_ms: now_ms,
                                is_active: true,
                            };
                            // Keep the best pool per DEX (highest liquidity)
                            let dex_key = dex.clone();
                            if let Some(existing) = best_pools.get(&dex_key) {
                                if liq > existing.liquidity_usd {
                                    best_pools.insert(dex_key, pool);
                                }
                            } else {
                                best_pools.insert(dex_key, pool);
                            }
                        }
                    }
                }
            }
        }

        let active_pools: Vec<DynamicPoolState> = best_pools.into_values().collect();
        (symbol, name, effective_mcap, total_5m_vol, active_pools)
    }

    // =========================================================================
    // ⚡ OMNIDIRECTIONAL CROSS-DEX EVALUATION ENGINE
    // =========================================================================
    /// Evaluates ALL possible pairs (Raydium vs Meteora, Meteora vs Orca, etc.)
    /// This is the core fix: previously we only checked Pump vs Others.
    fn evaluate_all_pool_pairs(
        &self,
        mint: &str,
        symbol: &str,
        pools: &[DynamicPoolState],
        sol_price_usd: f64,
    ) {
        if pools.len() < 2 {
            return;
        }

        // Iterate through every unique combination of pools
        for i in 0..pools.len() {
            for j in (i + 1)..pools.len() {
                let pool_a = &pools[i];
                let pool_b = &pools[j];

                // Create a unique hash for this specific pair path to prevent double-checking
                let path_hash = (pool_a.price_usd.to_bits() ^ pool_b.price_usd.to_bits()) as u32;
                
                // Check trade lock (cooldown)
                if !self.trade_locks.try_acquire_lock(mint, path_hash, DEFAULT_COOLDOWN_MS) {
                    continue;
                }

                self.arbs_checked.fetch_add(1, Ordering::Relaxed);

                // Evaluate arbitrage in both directions (A->B and B->A)
                // The AMM module handles directionality internally, but we pass both pools
                if let Some(opp) = evaluate_optimal_arbitrage(
                    mint,
                    symbol,
                    pool_a,
                    pool_b,
                    sol_price_usd,
                    MIN_NET_PROFIT_SOL,
                ) {
                    // Deduplication check
                    let current_price_pair = (opp.pump_price_usd, opp.raydium_price_usd);
                    if let Some(last_price_pair) = self.last_known_prices.get(mint) {
                        if *last_price_pair == current_price_pair {
                            continue;
                        }
                    }

                    self.opps_found.fetch_add(1, Ordering::Relaxed);
                    self.last_known_prices.insert(mint.to_string(), current_price_pair);
                    
                    info!(
                        "🔥 [CROSS-DEX ARB FOUND] {} | {} vs {} | Net Profit: +{:.4} SOL (${:.2}) | Spread: +{:.2}%",
                        symbol, pool_a.dex, pool_b.dex, opp.net_profit_sol, opp.net_profit_usd, opp.net_spread_pct
                    );

                    self.paper_engine.execute_shadow_trade(&opp, sol_price_usd);
                    
                    // If we found an opp for this pair, break inner loop to avoid spamming
                    // but continue checking other pairs for this token.
                    break; 
                }
            }
        }
    }

    // =========================================================================
    // ⚡ REAL-TIME ON-CHAIN SWAP HANDLER (UPGRADED)
    // =========================================================================
    pub async fn handle_onchain_swap(&self, swap: LiveSwapEvent, sol_price_usd: f64) {
        if !self.tracking_registry.contains_key(&swap.mint) {
            return;
        }

        // 1. Update the specific pool that triggered this event (PumpSwap)
        let price_in_sol = swap.v_sol_in_bonding_curve / swap.v_tokens_in_bonding_curve;
        let pump_price_usd = price_in_sol * sol_price_usd;
        let pump_liq_usd = swap.v_sol_in_bonding_curve * 2.0 * sol_price_usd;

        let updated_pump_pool = DynamicPoolState {
            mint: swap.mint.clone(),
            dex: "PUMPSWAP".to_string(),
            pool_address: format!("bonding_curve_{}", swap.mint),
            price_usd: pump_price_usd,
            liquidity_usd: pump_liq_usd,
            last_update_ms: swap.timestamp_ms,
            is_active: true,
        };

        // 2. Update registry and trigger FULL evaluation
        if let Some(mut token) = self.tracking_registry.get_mut(&swap.mint) {
            // Update or insert the PumpSwap pool
            if let Some(idx) = token.pools.iter().position(|p| p.dex == "PUMPSWAP") {
                token.pools[idx] = updated_pump_pool;
            } else {
                token.pools.push(updated_pump_pool);
            }
            
            // 3. 🔥 CRITICAL FIX: Evaluate ALL pairs (Pump vs Raydium, Raydium vs Meteora, etc.)
            // We clone here because DashMap locks prevent passing reference to eval function safely
            let pools_snapshot = token.pools.clone();
            let symbol = token.symbol.clone();
            let mint = token.key().clone();
            
            // Drop the lock explicitly by moving out of scope or dropping reference
            drop(token); 

            self.evaluate_all_pool_pairs(&mint, &symbol, &pools_snapshot, sol_price_usd);
        }
    }

    pub async fn handle_raydium_migration(&self, mig: RaydiumMigrationEvent) {
        info!("🎉 [MIGRATION DETECTED] Mint: {} -> Raydium Pool: {} (Initial SOL: {:.2})", 
            mig.mint, mig.pool_address, mig.initial_sol_liquidity
        );

        let (symbol, name, mcap, vol, pools) = self.fetch_live_pools(&mig.mint).await;
        if pools.len() >= 2 {
            let total_liq: f64 = pools.iter().map(|p| p.liquidity_usd).sum();
            let vol_score = if total_liq > 0.0 { (vol / total_liq)