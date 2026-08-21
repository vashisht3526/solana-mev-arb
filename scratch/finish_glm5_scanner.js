const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_BASE_URL = 'bedrock-mantle.us-east-1.api.aws';
const MANTLE_PATH = '/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';
const MODEL = 'zai.glm-5';

const PROJECT_ROOT = 'C:\\Users\\Vashisht\\.gemini\antigravity\\scratch\\solana-mev-arb';

const systemPrompt = `You are an elite Solana MEV Quantitative Researcher and Rust Systems Engineer.
You write production-grade, highly optimized, memory-safe, zero-warning Rust code for high-frequency trading.`;

const userPrompt = `Here is the current code of src/scanner.rs up to line 545:

Please provide the COMPLETE, clean, full content for **src/scanner.rs** from start to finish, ensuring:
1. No truncated lines at the end.
2. Complete implementation of:
   - \`execute_arbitrage_trade\`
   - \`spawn_discovery_scout\`
   - \`spawn_volatility_auditor\`
   - \`spawn_sol_price_updater\`
   - \`spawn_stale_token_evictor\`
   - \`extract_symbol\`
3. Correct imports matching our codebase:
   - \`use crate::amm::evaluate_optimal_arbitrage;\`
   - \`use crate::types::{ArbitrageOpportunity, DynamicPoolState, VolatileTrackedToken};\`
   - \`use crate::websocket_feed::{LiveSwapEvent, RaydiumMigrationEvent, PumpPortalFeed};\`
   - \`use crate::paper_engine::PaperTradingEngine;\`

Return ONLY the complete raw Rust code enclosed in \`\`\`rust ... \`\`\`. No placeholders.`;

const payload = JSON.stringify({
    model: MODEL,
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ],
    max_tokens: 4096,
    temperature: 0.2
});

console.log(`[GLM-5 Consult] Requesting complete unabridged src/scanner.rs from ${MODEL}...`);

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
                console.log(`SUCCESS! Complete GLM-5 scanner written directly to:\n${targetFile}`);
                console.log(`======================================================\n`);
                console.log(`File size: ${rustCode.length} characters.`);
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
