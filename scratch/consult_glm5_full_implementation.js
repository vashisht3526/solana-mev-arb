const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_API_URL = 'https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';

const prompt = `You are GLM-5 (zai.glm-5), the world-class quantitative researcher and Solana MEV architect.
The user wants you to design and generate the COMPLETE Rust codebase for our Solana MEV Arbitrage Engine, modeling the exact institutional architecture of the $1.8M profit wallet (MRiYA4oN3158fCV8evhuCofrDzbHyYvYnGZUDJvoCsa), but adapted for $0 EXTERNAL COST:

CONSTRAINTS & REQUIREMENTS:
1. $0 External Cost: Use free high-throughput WebSocket streams (PumpPortal wss://pumpportal.fun/api/data for trade/migration events + free public Solana RPC / DexScreener dynamic scout) - NO $500/mo paid gRPC.
2. Multi-DEX Venues Supported:
   - Raydium CPMM & CLMM
   - Meteora DLMM
   - Orca Whirlpools
   - PumpSwap / Pump.fun
3. Atomic Router Logic (mirroring contract AN225ksocfZpbPVEbwffiANbtUdYbySM3WJ6dbsYAqij):
   - Off-chain instruction bundling for 2-leg atomic swaps with on-chain invariant check: require!(final_sol >= input_sol + min_profit).
   - Atomic revert simulation on slippage / frontrun.
4. Probabilistic Priority Fee Ladder & Jito Bundling:
   - Dynamic Jito tip allocation (25-50% of net margin, clamped [0.0001, 0.05 SOL]).
   - Tiered compute budget priority fee simulator.
5. High-Throughput Rust Architecture:
   - Lock-free atomic TradeLockTable (Bitpacked AtomicU64 with cooldown expiry + path hash).
   - Dual-trigger pipeline: Microsecond WebSocket events + Continuous 4s Active Volatility Multi-DEX Auditor.
   - Bounded ring buffers (tokio mpsc channel).

Please provide the complete, drop-in, compile-ready Rust code for the following modules:
- \`src/types.rs\`
- \`src/router.rs\`
- \`src/amm.rs\`
- \`src/scanner.rs\`

Make sure all types, function signatures, and imports align seamlessly.`;

const postData = JSON.stringify({
    model: "zai.glm-5",
    messages: [
        { role: "system", content: "You are GLM-5, the leading Solana MEV architect and quantitative engineer. Provide full, complete, production-ready Rust code without placeholders." },
        { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 4096
});

const url = new URL(MANTLE_API_URL);
const req = https.request({
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MANTLE_BEARER_TOKEN}`,
        'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 180000
}, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.choices && json.choices.length > 0) {
                const answer = json.choices[0].message.content;
                fs.writeFileSync(path.join(__dirname, 'glm5_full_system_code.md'), answer);
                console.log("GLM-5 full system code generated and saved successfully!");
                console.log("Length:", answer.length);
            } else {
                console.error("API error response:", data);
            }
        } catch (e) {
            console.error("JSON parse error:", e, data);
        }
    });
});

req.on('error', (e) => console.error("Request error:", e));
req.write(postData);
req.end();
