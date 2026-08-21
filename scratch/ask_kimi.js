const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_BASE_URL = 'bedrock-mantle.us-east-1.api.aws';
const MANTLE_PATH = '/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';
const MODEL = 'moonshotai.kimi-k2.5';

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

const systemPrompt = `You are an elite Solana MEV Quantitative Researcher, High-Frequency Trading Systems Architect, and Rust Core Engineer.
You specialize in microsecond cross-DEX atomic arbitrage, constant-product AMM ($xy=k$) & concentrated liquidity (Raydium CPMM/CLMM, Meteora DLMM, PumpSwap/Pump.fun bonding curves, Orca Whirlpools), triangular arbitrage, and Jito bundle game theory.

You will be provided with the complete, latest Rust source code and Node.js dashboard of a live Solana arbitrage engine.
Your task:
1. Conduct a brutal, mathematically rigorous code review of the entire system. Identify exactly where it lacks, edge cases in the quadratic optimal sizing solver, latency bottlenecks, and missed arbitrage opportunities.
2. Provide concrete, high-conviction architectural and mathematical improvements to maximize real profits, capture triangular multi-hop routes, and achieve sub-millisecond execution.
3. Provide complete, production-ready Rust code replacements for any components that need upgrading.`;

const userPrompt = `Here is our complete Solana Cross-DEX Arbitrage Engine source code:

${codebaseBundle}

Please provide an in-depth, rigorous review:
1. CODE & LOGIC AUDIT:
   - Where does our current implementation lack? Are there numerical instabilities or division-by-zero risks in our quadratic optimal sizing solver in \`src/amm.rs\`?
   - How can we make the pool state representation in RAM faster and more accurate?

2. TRIANGULAR & MULTI-HOP EXPANSION:
   - How can we expand from simple 2-pool spatial arb to 3-pool triangular arb (e.g. SOL -> Token A -> Token B -> SOL or Pump.fun -> Raydium -> Meteora -> SOL)?

3. LOCK-FREE PIPELINE & PERFORMANCE:
   - How can we optimize event dispatching and token tracking for maximum throughput?

4. COMPLETE PRODUCTION CODE UPGRADES:
   - Generate production-grade, complete Rust code snippets to directly upgrade \`src/amm.rs\` and \`src/scanner.rs\`.`;

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
                
                const outputFile = path.join(PROJECT_ROOT, 'scratch', 'kimi_profit_optimization_review.md');
                fs.mkdirSync(path.dirname(outputFile), { recursive: true });
                fs.writeFileSync(outputFile, reply, 'utf8');

                console.log(`\n======================================================`);
                console.log(`SUCCESS! Kimi k2.5 Analysis saved to:\n${outputFile}`);
                console.log(`======================================================\n`);
                console.log(reply.substring(0, 1500) + '\n\n... [Full comprehensive review saved to file]');
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
