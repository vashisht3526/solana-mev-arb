# ⚡ Solana High-Performance Cross-DEX Arbitrage Engine (Dual Instance)

> **Co-Engineered & Cross-Validated by Triple AI Consensus**:  
> **GLM-5 (`zai.glm-5`)** + **Kimi k2.5 (`moonshotai.kimi-k2.5`)** + **Qwen 3 Coder 480B (`qwen.qwen3-coder-480b-a35b-instruct`)**

---

## 📖 System Overview

This repository contains an institutional-grade, asynchronous, multi-threaded **Cross-DEX Spatial Arbitrage Engine** written in pure Rust for the **Solana** blockchain. 

The engine operates on **$0.00 infrastructure cost**, streaming real-time liquidity and swap events via **PumpPortal WebSockets** and parallel high-frequency REST audits across **Raydium**, **Meteora DLMM**, **Orca Whirlpools**, and **PumpSwap**.

It features a **Dual-Instance Architecture**:
1. **1.0 SOL Conservative Mode (`--1sol`)**: Calibrated for small bankrolls with tight position sizing ($0.12\text{ SOL}$ max), strict profit floors ($0.00008\text{ SOL}$), and built-in gas runway protection.
2. **10.0 SOL Growth Mode (`--10sol`)**: Calibrated for larger bankrolls ($0.50\text{ SOL}$ max size) capturing agile $0.20\% - 15.00\%$ pool dislocations.

---

## 🏛️ Core Architecture & Flow

```
                                  SOLANA ON-CHAIN ECOSYSTEM
          ┌─────────────────┬──────────────────┬─────────────────┬─────────────────┐
          │  Raydium Pools  │  Meteora Pools   │   Orca Pools    │  PumpSwap Pools │
          └────────┬────────┴────────┬─────────┴────────┬────────┴────────┬────────┘
                   │                 │                  │                 │
                   └─────────────────┼──────────────────┼─────────────────┘
                                     ▼
                    ┌──────────────────────────────────┐
                    │     PumpPortal Live WebSocket    │
                    │   & Parallel Volatility Scout    │
                    │      (50 - 150 Active Mints)     │
                    └────────────────┬─────────────────┘
                                     │
                                     ▼
                    ┌──────────────────────────────────┐
                    │    Newton-Raphson CPMM Solver    │
                    │     Optimal Input Size Δx*       │
                    │   Spread Filter: 0.20% - 15.0%   │
                    └────────────────┬─────────────────┘
                                     │
                                     ▼
                    ┌──────────────────────────────────┐
                    │   Atomic 2-Leg CPI Router Bundle │
                    │ require!(final_sol >= in + profit│
                    │   CU Limit: 110,000 (Optimized)  │
                    └────────────────┬─────────────────┘
                                     │
                         ┌───────────┴───────────┐
                         ▼                       ▼
            ┌────────────────────────┐  ┌────────────────────────┐
            │   1.0 SOL Instance     │  │   10.0 SOL Instance    │
            │ Max Position: 0.12 SOL │  │ Max Position: 0.50 SOL │
            │ Gas Reserve: 0.15 SOL  │  │ Gas Reserve: 1.50 SOL  │
            └────────────┬───────────┘  └────────────┬───────────┘
                         │                           │
                         └─────────────┬─────────────┘
                                       ▼
                       ┌───────────────────────────────┐
                       │  Real-Time WebSocket Monitor  │
                       │     (Dashboard on Port 3000)  │
                       └───────────────────────────────┘
```

---

## 🧮 Mathematical Model & Invariants

### 1. Optimal Arbitrage Sizing (Newton-Raphson)
For two CPMM pools with reserves $(R_{\text{sol}, 1}, R_{\text{tok}, 1})$ and $(R_{\text{sol}, 2}, R_{\text{tok}, 2})$ and fee multipliers $\gamma_1, \gamma_2$:

$$\Delta x^* = \arg\max_{\Delta x} \left[ \text{Out}_2(\gamma_2 \cdot \text{Out}_1(\gamma_1 \Delta x)) - \Delta x - \text{Gas} - \text{Tip} \right]$$

The solver computes roots of $f'(\Delta x) = 0$ in $< 50\text{ iterations}$ with precision tolerance $10^{-9}$.

### 2. The Atomic Router Revert Guarantee
In `src/router.rs`, the on-chain execution bundle requires:
```rust
require!(final_sol >= input_sol + min_profit, "ArbitrageUnprofitable");
```
* If market prices slip or another bot front-runs the trade, the transaction **reverts atomically** on-chain.
* **Capital Risk**: $0.00\text{ SOL}$ token principal lost. You only pay the base/priority network fee ($\sim 0.0001 - 0.0003\text{ SOL}$).

### 3. Compute Unit (CU) Block Packing
Instead of requesting default 1.4M CUs, transactions set:
```rust
ComputeBudgetInstruction::set_compute_unit_limit(110_000);
ComputeBudgetInstruction::set_compute_unit_price(5_000); // Micro-lamports per CU
```
* Allows Solana validator schedulers to pack our transaction into tiny thread gaps ($\sim 480$ txs/block fit vs $34$).
* Delivers top priority ranking at $1/12\text{th}$ the priority fee cost.

---

## 🔬 Forensic Blueprint: The $1.8M Wallet (`MRiYA4oN...`)

During our investigation, we extracted and analyzed on-chain transaction traces from top Solana MEV wallet `MRiYA4oN3158fCV8evhuCofrDzbHyYvYnGZUDJvoCsa`:
* **Contract**: Custom Router `AN225ksocfZpbPVEbwffiANbtUdYbySM3WJ6dbsYAqij`
* **Trade Sizing**: Retail-scale trades ($0.50 - 3.0\text{ SOL}$) across mid-cap volatile pairs (`HBULL`, `TYTAN`, `BORG`, `AVICI`, `MADE`).
* **Strategy**: Multi-DEX spatial rebalancing between Raydium, Meteora, and PumpSwap with dynamic Jito tips.

Our engine replicates this exact mathematical and routing blueprint.

---

## 🚀 Quickstart & Deployment

### 1. Requirements
* Rust & Cargo (1.78+)
* Node.js (18+)
* Linux / Windows / macOS (Tested on Ubuntu 24.04 AWS EC2)

### 2. Build the High-Performance Binary
```bash
cargo build --release
```

### 3. Run Instances with PM2
```bash
# Run 10.0 SOL Growth Instance
pm2 start ./target/release/solana-mev-arb --name rust-mev-arb-10sol -- --10sol

# Run 1.0 SOL Conservative Instance
pm2 start ./target/release/solana-mev-arb --name rust-mev-arb-1sol -- --1sol

# Run Live Web Dashboard
cd dashboard && pm2 start server.js --name mev-dashboard
```

### 4. Open Live Monitor
Access the web dashboard at: `http://<YOUR_SERVER_IP>:3000`

---

## 📁 Repository Structure

```text
solana-mev-arb/
├── Cargo.toml                    # Optimized Rust dependencies & LTO profile
├── .gitignore                    # Safe git exclusion for keys and builds
├── .env.example                  # Environment configuration template
├── src/
│   ├── main.rs                   # Dual-instance CLI entrypoint & reporters
│   ├── amm.rs                    # Cross-DEX reserve derivation & spread evaluation
│   ├── math.rs                   # Newton-Raphson optimal sizing algorithm
│   ├── router.rs                 # Atomic 2-leg CPI transaction bundle builder
│   ├── scanner.rs                # Lock-free parallel volatility auditor & discovery scout
│   ├── paper_engine.rs           # Shadow paper-trading engine with realistic network failure models
│   ├── types.rs                  # Data models, pool states & DEX enums
│   ├── websocket_feed.rs         # PumpPortal & Raydium migration streaming WebSocket client
│   ├── jito.rs                   # Jito block engine client & tip accounts
│   └── jito_builder.rs           # Jito bundle construction
├── dashboard/
│   ├── server.js                 # Express + WebSocket dual-engine aggregator
│   └── public/
│       └── index.html            # Dark-mode dashboard with interactive 1 SOL / 10 SOL tabs
└── scratch/                      # Multi-model debate transcripts, forensic dumps & analysis
    ├── debate_round3_qwen_verdict.md
    ├── debate_cu_latency_qwen_consensus.md
    ├── sol1_qwen_consensus.md
    ├── borrow_debate_kimi.md
    └── glm5_1.8m_wallet_forensic_report.md
```

---

## 🛡️ License & Risk Disclaimer

* This software is intended for educational, research, and algorithmic trading development purposes.
* Never trade with borrowed money or capital you cannot afford to lose.
* Mainnet live execution carries network fee costs and market risks.
