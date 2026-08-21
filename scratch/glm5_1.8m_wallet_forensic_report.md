# FORENSIC ANALYSIS: Solana MEV Architecture (Target: MRiYA4oN3158fCV8evhuCofrDzbHyYvYnGZUDJvoCsa)

**Classification:** CONFIDENTIAL // ARCHITECTURAL BLUEPRINT
**Analyst:** GLM-5 (zai.glm-5)
**Subject:** High-Frequency Spatial Arbitrage System
**Verdict:** Sophisticated multi-venue spatial arbitrage utilizing a custom atomic router with aggressive probabilistic execution.

---

## 1. TRADING STYLE & MECHANICS

### 1.1 Strategy Identification: Multi-Venue Spatial Arbitrage
This wallet is not executing simple cyclic arbitrage (e.g., SOL → USDC → RAY → SOL). Instead, it is running **high-frequency spatial arbitrage** with a focus on venue-specific price discrepancies.

**Evidence:**
The transaction logs reveal interactions with at least four distinct liquidity venues within a compressed timeframe (Slot 440668613 to 440668862):
1.  **Raydium AMM V2/CLMM:** (`whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`) - Used for "SwapV2".
2.  **Raydium CPMM:** (`CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C`) - Used for "SwapBaseInput".
3.  **Orca Whirlpools:** (`DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH`) - Used for "Swap2".
4.  **Meteora DLMM:** (`LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`) - Used for "Swap2".
5.  **Pump.fun Bonding Curves:** (`pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA`) - Used for "BuyExactQuoteIn".

**Mechanism:**
The bot monitors the mempool (via Geyser) for large swaps that create price impact. It calculates the theoretical price on Venue B (e.g., Raydium) after a swap occurs on Venue A (e.g., Orca).
-   **Scenario:** A victim swaps on Orca, driving the price of SOL down.
-   **Counter-Action:** The bot detects this and immediately submits a buy on Orca (lower price) and a sell on Raydium (higher price) atomically.

### 1.2 The Custom Router: `AN225ksocfZpbPVEbwffiANbtUdYbySM3WJ6dbsYAqij`
This Program ID is the "brain" of the operation. It is a **Custom Atomic Router**.

**Function:**
It acts as a dispatcher. Instead of the user signing a transaction for Raydium, then another for Orca, the user signs *one* transaction calling `AN225...`.
1.  `AN225...` receives the instruction.
2.  It performs CPI (Cross-Program Invocation) to Venue A (e.g., `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`).
3.  It immediately performs a CPI to Venue B.
4.  **Crucially:** It calculates the profit *inside* the contract. If `output_amount > min_profit_threshold`, the transaction succeeds. If not, it triggers an intentional revert.

### 1.3 The "Intentional Revert" Phenomenon
The data shows a massive failure rate (approx. 50-60% in the provided dump).
-   **Observation:** Slots 440668860 contain 7 failed transactions with similar fees (~0.00025 SOL).
-   **Reasoning:** This is **Probabilistic Sniping**.
    -   The bot detects a potential opportunity but cannot guarantee the exact state of the order book at the moment of execution (due to network latency or other bots).
    -   It "sprays" transactions (multi-threaded submission) to land in the same block or subsequent blocks.
    -   **Atomic Invariant:** The custom contract likely contains a `require!(profit > gas_cost)` check. If the trade doesn't yield profit, it reverts.
    -   **Why 0 Token Loss?** On Solana, if a transaction reverts, state changes are rolled back. The only loss is the **Priority Fee** (Rent/Compute).
    -   **Conclusion:** The operator treats the lost fees (approx $0.04 per failed tx) as the cost of "buying lottery tickets" to land a block space position for a massive payout. They are spamming the block to ensure *one* transaction lands in the optimal position relative to the victim transaction.

---

## 2. SYSTEM ARCHITECTURE & LATENCY PROFILE

### 2.1 Off-Chain Infrastructure (The "Searcher")
To achieve the throughput seen here (multiple txs in slot 440668860), the architecture must be:

1.  **Geyser gRPC Plugin:** Direct subscription to the validator's ledger. They are not using standard RPC (`wss://...`). They are streaming block updates directly from a staked validator.
2.  **Rust Async Engine:** The bot is written in Rust, utilizing `tokio` for asynchronous task processing. It likely parses packets before they are fully confirmed (mempool sniffing).
3.  **Quic-based Transaction Submission:** To pack 7 transactions into one slot, they are utilizing the QUIC protocol (Solana's default for transaction submission) with optimized connection pooling to bypass congestion.

### 2.2 Multi-TX Block Packing
-   **Observation:** 7 transactions in Slot 440668860.
-   **Technique:** This is likely **Jito Bundling** or high-frequency **Batch Submission**.
    -   If using Jito, they submit a bundle of [Tx_Fail_1, Tx_Fail_2, Tx_Success_3]. The validator executes them in order. If Tx_Success lands, it pays the tip. If all fail, no tip is paid (only priority fees to the network).
    -   However, seeing multiple failures in the *same* slot suggests they are firing "blind" via standard submission channels to increase the probability of landing *any* transaction, essentially brute-forcing the entry.

### 2.3 Compute Budget & Fees
-   **Fee Analysis:** Fees range from 0.00003 SOL to 0.00033 SOL.
-   **Dynamic Pricing:** The bot calculates the necessary priority fee to land the transaction during high contention. The failed transactions in slot 440668860 have varying fees (0.00025 - 0.00033), suggesting they are testing different fee levels simultaneously to find the "clearing price" for block inclusion.

---

## 3. BLUEPRINT: HOW TO CLONE & ADAPT

To replicate this $1.8M architecture, you must build a three-component system.

### Phase 1: On-Chain Program (The Atomic Router)
**Language:** Rust (Native or Pinocchio for speed, Anchor for ease).
**Program ID:** Your custom `MEV_ROUTER`.

**Core Logic (Pseudo-code):**
```rust
fn arbitrage(ctx: Context<Arbitrage>, amount_in: u64) -> Result<()> {
    // 1. Flash Loan or use existing wallet balance
    let borrowed_tokens = flash_loan(amount_in)?;

    // 2. Swap on Venue A (e.g., Orca)
    let intermediate_amount = swap_on_orca(ctx.accounts.orca_program, borrowed_tokens)?;

    // 3. Swap on Venue B (e.g., Raydium)
    let final_amount = swap_on_raydium(ctx.accounts.raydium_program, intermediate_amount)?;

    // 4. Repay Flash Loan
    repay_flash_loan(amount_in)?;

    // 5. PROFIT ASSERTION (The Atomic Invariant)
    // If this fails, the whole transaction reverts, saving us from loss.
    require!(final_amount > amount_in + min_profit, "No Arbitrage Opportunity");

    // 6. Distribute Profit
    transfer_to_wallet(final_amount - amount_in)?;
    Ok(())
}
```

**Deployment:**
-   Deploy this program.
-   Whitelist specific DEXs (Orca, Raydium, Meteora) by their Program IDs to save compute units.

### Phase 2: Off-Chain Infrastructure (The Searcher)
**Stack:**
1.  **Yellowstone Geyser:** Run a Geyser plugin to a Kafka/ClickHouse database. This gives you <100ms latency on chain updates.
2.  **Calculation Engine:**
    -   Maintain an in-memory Order Book (CLMMs & AMMs).
    -   On every `AccountUpdate` (slot update), recalculate arbitrage paths.
    -   Use a Bellman-Ford algorithm to detect negative cycles (arbitrage paths).
3.  **Tx Sender:**
    -   Use `solana-client` with a custom connection pool.
    -   Implement "Pre-flight Simulation" locally to filter out guaranteed failures (though this bot suggests skipping this to save time).

### Phase 3: Execution Strategy
**Actionable Roadmap:**
1.  **Week 1:** Deploy the Router Contract. Test on Devnet with simulated swaps between Raydium and Orca.
2.  **Week 2:** Set up a Geyser node (requires high-spec server, 128GB RAM, NVMe).
3.  **Week 3:** Implement the "Spray" logic.
    -   Instead of sending 1 perfect transaction, send 5 variations with slightly different amounts and fees.
    -   Accept that 80% will fail and cost fees.
    -   Optimize for the *one* transaction that lands and captures the spread.
4.  **Week 4:** Integrate Jito.
    -   Instead of paying priority fees to the network, bundle transactions and pay a "tip" to the validator. This guarantees atomic execution (all succeed or all fail) and often better block positioning.

**Final Recommendation:**
This wallet is not "gambling"; it is running a high-frequency statistical arbitrage operation. The failures are the cost of doing business to ensure they are first in line when a real opportunity arises. To clone this, you must accept the "fail fee" burn rate as your operational cost for acquiring block space.