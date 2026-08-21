I am GLM-5. I am initializing my Solana Runtime & MEV architecture module. I will address your two core questions with the precision of a low-level systems engineer.

You are asking about the fundamental physics of the Solana Virtual Machine (SVM) and how to exploit them with zero capital expenditure (CapEx). Here is the technical breakdown.

---

### 1. COMPUTE UNIT (CU) OPTIMIZATION: The "Space-Time" Compression

You asked why lowering CUs increases fill probability. The answer lies in **Solana’s Multithreaded Scheduling and Block Space Economics.**

#### The Mechanism: Cost per CU vs. Total Fee
Unlike Ethereum, which is single-threaded (one transaction at a time, paying for "gas"), Solana is multithreaded. It executes transactions in parallel across multiple "pipelines" or threads.

A validator’s scheduler (the software component deciding which transactions enter the block) faces a hard constraint: **The Compute Budget (currently 48M CU per block).**

When you set your transaction to the default 200k or 1.4M CU, but your actual logic only consumes 100k CU, you are engaging in "block space hoarding." You are reserving a larger chunk of that 48M limit than necessary.

**The Scheduling Formula:**
Validators (especially Jito and aggressive RPC nodes) sort the pending queue by **Priority Fee per Compute Unit**.
$$ \text{Priority} = \frac{\text{Total Priority Fee}}{\text{Requested Compute Units}} $$

**The Optimization Logic:**
1.  **Scenario A (Lazy):** You request 200,000 CUs. You pay a 10,000 microlamport priority fee.
    *   *Priority Score:* $10,000 / 200,000 = 0.05$.
    *   *Validator View:* This tx takes up 200k space.
2.  **Scenario B (Optimized):** You profile your code (using `simulateTransaction` with `sigVerify: false`) and see it only uses 89,000 CUs. You set the limit to 100,000 CUs (adding a small buffer). You keep the fee at 10,000 microlamports.
    *   *Priority Score:* $10,000 / 100,000 = 0.10$.
    *   *Validator View:* This tx takes up 100k space.

**Result:** Scenario B has **double the priority score** for the exact same cost. It jumps the queue. It is "denser" value for the validator. By lowering the CU ceiling, you are compressing your "space" footprint, allowing the scheduler to fit you into tighter block windows without paying a higher bribe.

---

### 2. ATOMIC LATENCY & THE $0 ARCHITECTURE MYTH

You asked how it is physically possible to beat HFT nodes with free infrastructure. The answer is: **You do not beat them on network latency (Layer 1); you beat them on execution atomicity (Layer 0).**

#### The "Zero Latency" Trick: Atomic CPI (Cross-Program Invocation)
In traditional CeFi or EVM DEX arbitrage, an arb involves:
1.  Tx 1: Buy on DEX A (Latency $t_1$)
2.  Tx 2: Transfer/Sell on DEX B (Latency $t_2$)
3.  Total Latency: $t_1 + t_2 + \text{network\_jitter}$.

On Solana, we use **Atomic CPI**.
You construct a single transaction containing instructions for both DEX A and DEX B.
1.  Instruction 1: Swap on Raydium (DEX A).
2.  Instruction 2: Swap on Orca (DEX B).

**The Physics:**
This is executed inside a single **BPF VM invocation**.
*   The time between the Buy on DEX A and the Sell on DEX B is measured in **microseconds** (CPU cycle time), not milliseconds (network time).
*   **There is zero network latency between the legs.** If the first instruction fails (e.g., price moved), the entire transaction reverts. You cannot be left holding the bag.
*   **Slot Time:** This entire atomic bundle lives or dies within one slot (~400ms). You are not racing against fiber optics between two transactions; you are executing a single logical operation.

#### How to Win with $0 Infrastructure (Spatial Dislocation)
If you use free WebSockets (PumpPortal/DexScreener), you have ~100-200ms latency. Private fiber nodes have <5ms. **You will lose a pure speed race.**

However, you are not playing a speed game; you are playing a **Spatial Persistence Game.**

**Mempool Frontrunning vs. Spatial Dislocation:**
1.  **Mempool Frontrunning (Solana Edition):**
    *   On Ethereum, this is easy (see tx in mempool -> pay higher gas).
    *   On Solana, this is **impossible** natively. There is no global mempool. Transactions are forwarded directly to leaders via gossip. You cannot "see" a pending transaction and react to it faster than light allows.
    *   *Exception:* Jito bundles allow "tips" to searchers, but standard frontrunning requires infrastructure you don't have.

2.  **Spatial Pool Dislocation (Your Strategy):**
    *   This occurs when a mid-cap token (e.g., on Pump.fun) has a liquidity migration or a large swap that creates a price gap between a DEX aggregator and the bonding curve.
    *   **Persistence:** These inefficiencies often last **1 to 5 seconds**.
    *   *Why?* Because institutional bots are calibrated for high-volume pairs (SOL/USDC). Mid-caps have lower liquidity, and the "risk parameters" of HFT bots often make them hesitate to deploy capital on volatile assets.
    *   **The Window:** If the inefficiency lasts 3 seconds (3000ms), and your free WebSocket has 200ms latency, **you have plenty of time.** You are not racing against microseconds. You are racing against the "decay time" of the spread.

**Summary of the $0 Strategy:**
You rely on the **Atomic CPI** to eliminate execution risk (no leg risk) and **Spatial Dislocation** to eliminate speed requirements. You are not faster than the HFTs; you are simply targeting markets where the inefficiency is "sticky" enough for free data feeds to capture it.