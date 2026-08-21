const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_BASE_URL = 'bedrock-mantle.us-east-1.api.aws';
const MANTLE_PATH = '/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';
const MODEL = 'zai.glm-5';

const PROJECT_ROOT = 'C:\\Users\\Vashisht\\.gemini\\antigravity\\scratch\\solana-mev-arb';

const filesToRead = [
    'Cargo.toml',
    'src/main.rs',
    'src/amm.rs',
    'src/scanner.rs',
    'src/paper_engine.rs',
    'src/types.rs',
    'src/websocket_feed.rs',
    'src/jito.rs',
    'src/jito_builder.rs',
    'dashboard/server.js'
];

let codebaseBundle = '';
for (const relPath of filesToRead) {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        codebaseBundle += `==================== FILE: ${relPath} ====================\n\`\`\`rust\n${content}\n\`\`\`\n\n`;
    }
}

const systemPrompt = `You are an elite Solana MEV Quantitative Researcher and High-Frequency Trading Systems Architect. 
You specialize in microsecond cross-DEX atomic arbitrage, constant-product & concentrated liquidity AMMs (Raydium CPMM/CLMM, Meteora DLMM, PumpSwap/Pump.fun bonding curves, Orca Whirlpools), and Jito block-engine bundle optimization.

You will be provided with the complete Rust source code and Node.js dashboard of a live Solana arbitrage engine.
Your objective: Provide a thorough, brutal, production-grade quantitative analysis and specific mathematical & architectural recommendations to MAXIMIZE NET PROFIT, WIN RATE, and OPPORTUNITY CAPTURE RATE while preserving zero inventory risk.`;

const userPrompt = `Here is the complete source code of our Solana Cross-DEX Arbitrage Engine:

${codebaseBundle}

Please analyze this codebase thoroughly and provide deep, actionable recommendations on:

1. OPTIMAL POSITION SIZING MATH (Closed-Form Analytical Solution):
   - Currently, we use a conservative heuristic: \`actual_swap_sol = min(base_swap_sol, (pool_liquidity * 0.03) / sol_price)\`.
   - Derive and provide the exact mathematical formula for the *optimal arbitrage trade size* $s^*$ between two constant-product AMM pools (Pool A with reserves $x_1, y_1$, fee $\\gamma_1$ and Pool B with reserves $x_2, y_2$, fee $\\gamma_2$) that maximizes net profit after price impact and DEX fees.

2. LATENCY & EVENT PIPELINE BOTTLENECKS:
   - How can we eliminate remaining latency bottlenecks between PumpPortal WebSocket swap events, DexScreener discovery, and Jito bundle generation?
   - What lock-free data structures in Rust (e.g., atomic pointers, evmap, crossbeam) should replace DashMap to achieve sub-microsecond lookup speeds?

3. CROSS-DEX ARBITRAGE EXPANSION:
   - How can we add Meteora Dynamic AMM (DLMM bin math) and Raydium CLMM (tick math) into this exact engine to capture 5x-10x more multi-pool price discrepancies?

4. JITO BUNDLE & GAME-THEORETIC TIP OPTIMIZATION:
   - How should we dynamically price Jito tips based on block space competition, expected profit, and validator schedule to ensure >90% bundle landing rate without overpaying?

5. CONCRETE PRODUCTION CODE UPGRADES:
   - Provide production-ready Rust code snippets for the upgraded AMM math, optimal sizing calculation, and event dispatcher to directly maximize profitability.`;

const payload = JSON.stringify({
    model: MODEL,
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ],
    max_tokens: 8192,
    temperature: 0.3
});

console.log(`Sending complete codebase (${payload.length} bytes) to ${MODEL} via Bedrock Mantle...`);

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
                
                const outputFile = path.join(PROJECT_ROOT, 'scratch', 'glm5_profit_optimization_review.md');
                fs.mkdirSync(path.dirname(outputFile), { recursive: true });
                fs.writeFileSync(outputFile, reply, 'utf8');

                console.log(`\n======================================================`);
                console.log(`SUCCESS! GLM-5 Analysis saved to:\n${outputFile}`);
                console.log(`======================================================\n`);
                console.log(reply.substring(0, 1500) + '\n\n... [Full comprehensive report saved to file]');
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
