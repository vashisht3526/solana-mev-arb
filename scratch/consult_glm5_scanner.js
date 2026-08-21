const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_BASE_URL = 'bedrock-mantle.us-east-1.api.aws';
const MANTLE_PATH = '/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';
const MODEL = 'zai.glm-5';

const PROJECT_ROOT = 'C:\\Users\\Vashisht\\.gemini\\antigravity\\scratch\\solana-mev-arb';

const systemPrompt = `You are an elite Solana MEV Quantitative Researcher and Rust Systems Engineer.
You write production-grade, highly optimized, memory-safe, zero-warning Rust code for high-frequency trading.`;

const userPrompt = `We are implementing the scanner and execution loop in **src/scanner.rs** that utilizes our newly upgraded \`src/amm.rs\` (\`evaluate_optimal_arbitrage\`) and \`src/websocket_feed.rs\` (PumpPortal real-time on-chain WebSocket swap events).

Here is the signature of evaluate_optimal_arbitrage from src/amm.rs:
\`\`\`rust
pub fn evaluate_optimal_arbitrage(
    mint: &str,
    symbol: &str,
    pool_a: &DynamicPoolState,
    pool_b: &DynamicPoolState,
    sol_price_usd: f64,
    min_net_profit_sol: f64,
) -> Option<ArbitrageOpportunity>;
\`\`\`

And here is the live on-chain swap event from src/websocket_feed.rs:
\`\`\`rust
pub struct LiveSwapEvent {
    pub mint: String,
    pub tx_type: String,       // "buy" or "sell"
    pub sol_amount: f64,
    pub token_amount: f64,
    pub v_sol_in_bonding_curve: f64,
    pub v_tokens_in_bonding_curve: f64,
    pub market_cap_sol: f64,
    pub signature: String,
    pub timestamp_ms: i64,
}
\`\`\`

Please generate the COMPLETE, production-ready file **src/scanner.rs** that:
1. Maintains an in-memory tracking registry (\`DashMap<String, VolatileTrackedToken>\`).
2. Runs the background Discovery Scout to discover fresh volatile multi-pool tokens ($30k - $10M market cap).
3. Runs the Volatility Auditor to refresh pool states without dumping tokens on transient HTTP glitches.
4. Listens to incoming real-time on-chain swap events (\`LiveSwapEvent\`) and Raydium migrations from PumpPortal WebSocket.
5. In \`handle_onchain_swap\`:
   - Calculates the exact new Pump.fun price and liquidity from bonding curve reserves: \`price_in_sol = v_sol / v_tokens\`.
   - Updates the PumpSwap pool state in memory.
   - Evaluates cross-DEX arbitrage against all known paired pools on Raydium/Meteora/Orca using \`AmmEngine::evaluate_optimal_arbitrage\` (closed-form optimal trade size).
   - If an optimal opportunity is found, executes the shadow/live trade immediately via \`PaperTradingEngine\`.
6. Enforces per-token cooldowns and global trade throttling to prevent stale duplicates.

Return ONLY the complete raw Rust code for **src/scanner.rs** enclosed in \`\`\`rust ... \`\`\`. No placeholders, no pseudocode.`;

const payload = JSON.stringify({
    model: MODEL,
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ],
    max_tokens: 4096,
    temperature: 0.2
});

console.log(`[GLM-5 Consult] Requesting complete production src/scanner.rs from ${MODEL}...`);

const options = {
    hostname: MANTLE_BASE_URL,
    port: 443,
    path: MANTLE_PATH,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${MANTLE_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => { responseData += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const parsed = JSON.parse(responseData);
                const reply = parsed.choices[0].message.content;
                
                let rustCode = reply;
                if (reply.includes('```rust')) {
                    rustCode = reply.split('```rust')[1].split('```')[0].trim();
                } else if (reply.includes('```')) {
                    rustCode = reply.split('```')[1].split('```')[0].trim();
                }

                const targetFile = path.join(PROJECT_ROOT, 'src', 'scanner.rs');
                fs.writeFileSync(targetFile, rustCode, 'utf8');

                console.log(`\n======================================================`);
                console.log(`SUCCESS! GLM-5 authored scanner written directly to:\n${targetFile}`);
                console.log(`======================================================\n`);
                console.log(rustCode.substring(0, 1000) + '...');
            } catch (err) {
                console.error('JSON Parse Error:', err, responseData);
            }
        } else {
            console.error(`HTTP Error ${res.statusCode}:`, responseData);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e);
});

req.write(payload);
req.end();
