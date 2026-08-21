const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_BASE_URL = 'bedrock-mantle.us-east-1.api.aws';
const MANTLE_PATH = '/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';
const MODEL = 'moonshotai.kimi-k2.5';

const PROJECT_ROOT = 'C:\\Users\\Vashisht\\.gemini\\antigravity\\scratch\\solana-mev-arb';

const systemPrompt = `You are an elite Solana MEV Quantitative Researcher and Rust Systems Engineer.
You write complete, robust, compilable, zero-warning, production-grade Rust code for high-frequency Solana cross-DEX and triangular arbitrage.`;

const userPrompt = `We are implementing the second component of our Kimi k2.5 upgrade: **src/amm.rs**.

Here are our project requirements:
1. Use \`crate::math::{solve_optimal_arbitrage_newton, cpmm_output_exact, calculate_price_impact}\`.
2. Support \`DynamicPoolState\` from \`crate::types\`:
\`\`\`rust
pub struct DynamicPoolState {
    pub mint: String,
    pub dex: String,
    pub pool_address: String,
    pub price_usd: f64,
    pub liquidity_usd: f64,
    pub last_update_ms: i64,
    pub is_active: bool,
}

pub struct ArbitrageOpportunity {
    pub timestamp_ms: i64,
    pub iso_time: String,
    pub mint: String,
    pub symbol: String,
    pub name: String,
    pub target_dex: String,
    pub pair_address: String,
    pub pump_price_usd: f64,
    pub raydium_price_usd: f64,
    pub gross_spread_pct: f64,
    pub net_spread_pct: f64,
    pub pool_liquidity_usd: f64,
    pub simulated_swap_sol: f64,
    pub gross_profit_usd: f64,
    pub jito_tip_usd: f64,
    pub net_profit_usd: f64,
    pub net_profit_sol: f64,
}
\`\`\`
3. Implement public constants:
   - \`pub const BASE_GAS_FEE_SOL: f64 = 0.000005;\`
   - \`pub const PRIORITY_FEE_SOL: f64 = 0.0008;\`
4. Provide the public evaluation function:
\`\`\`rust
pub fn evaluate_optimal_arbitrage(
    mint: &str,
    symbol: &str,
    pool_a: &DynamicPoolState,
    pool_b: &DynamicPoolState,
    sol_price_usd: f64,
    min_net_profit_sol: f64,
) -> Option<ArbitrageOpportunity>
\`\`\`
5. Use Newton-Raphson from \`src/math.rs\` to accurately solve for optimal size $s^*$, calculate exact gross & net profit, deduct gas, deduct dynamic Jito tips, and construct the complete \`ArbitrageOpportunity\` struct.

Return ONLY the complete raw Rust code for **src/amm.rs** enclosed in \`\`\`rust ... \`\`\`. No placeholders, no pseudocode.`;

const payload = JSON.stringify({
    model: MODEL,
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ],
    max_tokens: 4096,
    temperature: 0.2
});

console.log(`[Kimi k2.5 Consult] Requesting complete production src/amm.rs from ${MODEL}...`);

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

                const targetFile = path.join(PROJECT_ROOT, 'src', 'amm.rs');
                fs.writeFileSync(targetFile, rustCode, 'utf8');

                console.log(`\n======================================================`);
                console.log(`SUCCESS! Kimi k2.5 authored amm.rs written directly to:\n${targetFile}`);
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
