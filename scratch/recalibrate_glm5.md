I have recalibrated the Solana MEV Arbitrage Bot parameters for a 1.0 SOL bankroll. The primary optimization goal is to maximize capital efficiency while maintaining a safety buffer for gas fees and enabling concurrent opportunity execution.

Below is the quantitative rationale followed by the specific Rust code changes.

### 1. Recalibrated Constants & Rationale

| Parameter | Old Value (10.0 SOL) | **New Value (1.0 SOL)** | Rationale |
| :--- | :--- | :--- | :--- |
| **Starting Balance** | 10.00 SOL | **1.0000 SOL** | Reduced capital base. |
| **Max Position Size** | 0.50 SOL (5%) | **0.15 SOL (15%)** | Increased percentage to ensure meaningful absolute returns, while leaving room for ~6 concurrent trades. |
| **Min Position Size** | N/A | **0.02 SOL** | Floor to ensure trade size exceeds dust thresholds and remains economically viable. |
| **Min Net Profit** | ~0.001 SOL | **0.00008 SOL** | Lowered threshold to capture micro-arbs. At ~0.0001 SOL gas, this yields ~$0.01 profit, viable for high-frequency botting. |
| **Min Spread %** | 0.50% | **0.35%** | Tightened to trigger arbitrage on smaller deviations, viable due to lower absolute gas costs relative to smaller positions. |
| **Jito Tip Strategy** | Fixed/High | **Dynamic (20% Margin)** | Protects margins. On a 0.0001 profit, tip is ~0.00002. Clamped to ensure inclusion without destroying ROI. |

---

### 2. Rust Code Changes

#### File: `src/main.rs`
**Change:** Update the global configuration constants.

```rust
// src/main.rs

// --- RECALIBRATED CONSTANTS FOR 1.0 SOL BANKROLL ---

/// Starting virtual wallet balance
pub const STARTING_BALANCE_SOL: f64 = 1.0000;

/// Maximum capital allocated to a single arbitrage loop
/// Logic: 15% of 1.0 SOL allows for meaningful exposure while preserving gas runway.
pub const MAX_POSITION_SOL: f64 = 0.15;

/// Minimum trade size to avoid dust errors and ensure economic viability
pub const MIN_POSITION_SOL: f64 = 0.02;

/// Minimum absolute profit required to trigger a trade (after estimated gas)
/// 80,000 lamports ~ $12 USD (at current prices), sufficient to cover gas + buffer.
pub const MIN_NET_PROFIT_SOL: f64 = 0.00008;

/// Minimum spread percentage required to trigger scanner alerts
pub const MIN_SPREAD_PCT: f64 = 0.35; // 0.35%

// Gas & Fee Constants
pub const BASE_GAS_SOL: f64 = 0.000005;
pub const PRIORITY_FEE_SOL: f64 = 0.0002; // Mid-range for 110k CUs
pub const JITO_TIP_PCT_OF_MARGIN: f64 = 0.20; // 20% of net profit
pub const JITO_TIP_MIN_SOL: f64 = 0.00005;
pub const JITO_TIP_MAX_SOL: f64 = 0.01;

fn main() {
    // Initialize logger
    env_logger::init();
    
    println!("Initializing Solana MEV Bot with 1.0 SOL Capital Allocation...");
    println!("Max Position: {} SOL | Min Profit Threshold: {} SOL", 
             MAX_POSITION_SOL, MIN_NET_PROFIT_SOL);

    // ... existing startup logic
}
```

#### File: `src/paper_engine.rs`
**Change:** Update the `PaperWallet` initialization and the position sizing logic within the execution loop.

```rust
// src/paper_engine.rs

use crate::{MAX_POSITION_SOL, MIN_POSITION_SOL, MIN_NET_PROFIT_SOL, STARTING_BALANCE_SOL};

pub struct PaperWallet {
    balance: f64,
}

impl PaperWallet {
    pub fn new() -> Self {
        Self {
            // RECALIBRATED: Initialize with 1.0 SOL
            balance: STARTING_BALANCE_SOL, 
        }
    }

    /// Calculates optimal trade size based on Kelly Criterion simplified (fixed fraction)
    /// or bounded by available balance.
    pub fn calculate_position_size(&self, spread_pct: f64) -> f64 {
        // Dynamic sizing logic: Scale position based on spread confidence
        // For 1.0 SOL, we use a linear scaling:
        // Low spread (0.35%) -> Min Position
        // High spread (>2.0%) -> Max Position
        
        let scale_factor = ((spread_pct - 0.35) / (2.0 - 0.35)).min(1.0).max(0.0);
        let dynamic_size = MIN_POSITION_SOL + (MAX_POSITION_SOL - MIN_POSITION_SOL) * scale_factor;
        
        // Ensure we don't exceed available balance (leaving 0.1 SOL for gas runway)
        let available_for_trade = (self.balance - 0.1).max(0.0);
        
        dynamic_size.min(available_for_trade).min(MAX_POSITION_SOL)
    }

    pub fn execute_arbitrage(&mut self, gross_profit: f64, gas_cost: f64, position_size: f64) {
        let net_profit = gross_profit - gas_cost;
        
        // RECALIBRATED: Check against tighter profit floor
        if net_profit < MIN_NET_PROFIT_SOL {
            println!("Skipping arb: Net profit {} below threshold {}", 
                     net_profit, MIN_NET_PROFIT_SOL);
            return;
        }

        // Simulate execution
        self.balance += net_profit;
        println!("Executed Paper Trade: +{} SOL | New Balance: {:.4} SOL", 
                 net_profit, self.balance);
    }
}
```

#### File: `src/scanner.rs`
**Change:** Update the filtering logic to use the new spread thresholds.

```rust
// src/scanner.rs

use crate::{MIN_SPREAD_PCT, MIN_NET_PROFIT_SOL, BASE_GAS_SOL, PRIORITY_FEE_SOL, JITO_TIP_PCT_OF_MARGIN, JITO_TIP_MIN_SOL, JITO_TIP_MAX_SOL};

pub struct Opportunity {
    pub spread_pct: f64,
    pub gross_profit_potential: f64,
    pub input_amount: f64,
}

pub fn scan_market(prices: &HashMap<String, f64>) -> Option<Opportunity> {
    // ... logic to fetch prices and calculate raw spread ...
    
    // Mock calculation for demonstration
    let raw_spread = calculate_raw_spread(&prices); 
    
    // RECALIBRATED: Filter based on new 0.35% threshold
    if raw_spread < MIN_SPREAD_PCT {
        return None;
    }

    // Estimate costs dynamically
    let estimated_gas = BASE_GAS_SOL + PRIORITY_FEE_SOL;
    
    // Dynamic Jito Tip Calculation
    // We estimate gross profit based on max position to check viability
    let estimated_gross = raw_spread * crate::MAX_POSITION_SOL; 
    let estimated_tip = (estimated_gross * JITO_TIP_PCT_OF_MARGIN)
                        .max(JITO_TIP_MIN_SOL)
                        .min(JITO_TIP_MAX_SOL);
    
    let total_cost = estimated_gas + estimated_tip;
    
    // Check if the spread covers the cost + profit floor
    if (raw_spread * crate::MAX_POSITION_SOL) - total_cost < MIN_NET_PROFIT_SOL {
        return None;
    }

    Some(Opportunity {
        spread_pct: raw_spread,
        gross_profit_potential: estimated_gross, // Simplified
        input_amount: crate::MAX_POSITION_SOL, // Will be refined by engine
    })
}
```

#### File: `src/amm.rs`
**Change:** Ensure AMM math handles smaller float precision correctly (no major logic change needed, but verifying `get_amount_out` works for 0.02-0.15 SOL inputs).

```rust
// src/amm.rs

// No structural changes required, but verify constants used in simulation.
// Ensure slippage tolerance is tight for smaller positions.

pub const SLIPPAGE_BPS: u16 = 50; // 0.5% slippage tolerance

pub fn get_amount_out(amount_in: f64, reserve_in: f64, reserve_out: f64) -> f64 {
    // Standard AMM math: x * y = k
    // Logic remains valid for 1.0 SOL bankroll.
    // Note: Ensure amount_in is not dust (handled by MIN_POSITION_SOL in engine).
    
    if amount_in < 0.00001 { // Dust check
        return 0.0;
    }

    let amount_in_with_fee = amount_in * 997.0; // 0.3% fee
    let numerator = amount_in_with_fee * reserve_out;
    let denominator = (reserve_in * 1000.0) + amount_in_with_fee;
    numerator / denominator
}
```