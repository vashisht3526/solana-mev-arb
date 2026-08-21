const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_BASE_URL = 'bedrock-mantle.us-east-1.api.aws';
const MANTLE_PATH = '/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';
const MODEL = 'moonshotai.kimi-k2.5';

const PROJECT_ROOT = 'C:\\Users\\Vashisht\\.gemini\\antigravity\\scratch\\solana-mev-arb';

const systemPrompt = `You are a Principal High-Frequency Trading Systems Architect and Solana MEV Specialist.
You write complete, compilable, zero-warning, production-grade Rust code for high-throughput MEV arbitrage.`;

const userPrompt = `We are implementing the complete, upgraded **src/scanner.rs** based on your architecture.

Requirements:
1. Lock-free \`TradeLockTable\` with atomic cooldown bitpacking (\`AtomicU64\`).
2. High-throughput bounded crossbeam channels connecting real-time WebSocket events to evaluation workers.
3. Integration with:
   - \`crate::amm::evaluate_optimal_arbitrage\`
   - \`crate::paper_engine::PaperTradingEngine\`
   - \`crate::websocket_feed::{LiveSwapEvent, PumpPortalFeed, RaydiumMigrationEvent}\`
   - \`crate::types::{ArbitrageOpportunity, DynamicPoolState, VolatileTrackedToken}\`
4. Fast in-memory state updates on bonding curve swaps and Raydium migrations.
5. Zero HTTP calls in the evaluation loop.
6. Public constructor \`pub fn new(paper_engine: Arc<PaperTradingEngine>) -> Self\` and \`pub async fn run(self: Arc<Self>)\`.

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

console.log(`[Kimi k2.5 Consult] Requesting complete production src/scanner.rs from ${MODEL}...`);

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
                console.log(`SUCCESS! Kimi k2.5 authored scanner written directly to:\n${targetFile}`);
                console.log(`======================================================\n`);
                console.log(rustCode.substring(0, 800) + '...');
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
