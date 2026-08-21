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

const userPrompt = `We are implementing the first component of our production Solana cross-DEX arbitrage upgrade: **src/amm.rs**.

Here are our data types in src/types.rs:
\`\`\`rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicPoolState {
    pub mint: String,
    pub dex: String,
    pub pool_address: String,
    pub price_usd: f64,
    pub liquidity_usd: f64,
    pub last_update_ms: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

Please generate the COMPLETE, fully functional, production-ready file **src/amm.rs** implementing:
1. Exact Closed-Form Analytical Optimal Trade Size ($s^*$) solving $\\frac{d\\Pi}{ds} = 0$ for two constant-product AMMs (Pool A buy, Pool B sell) with arbitrary pool fees $\\gamma_A, \\gamma_B$.
2. Conversion of USD liquidity / pool reserves into exact token and SOL reserves.
3. Realistic constant-product output calculation ($TokensOut = \\frac{R_{tok}^A \\cdot s^* \\cdot \\gamma_A}{R_{sol}^A + s^* \\cdot \\gamma_A}$ and $SolOut = \\frac{R_{sol}^B \\cdot TokensOut \\cdot \\gamma_B}{R_{tok}^B + TokensOut \\cdot \\gamma_B}$).
4. Exact gas deductions (base fee 5,000 lamports, priority gas) and dynamic Jito tip allocation (50% of net margin).
5. Method \`pub fn evaluate_optimal_arbitrage(mint: &str, symbol: &str, pool_a: &DynamicPoolState, pool_b: &DynamicPoolState, sol_price_usd: f64, min_net_profit_sol: f64) -> Option<ArbitrageOpportunity>\`.

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

console.log(`[GLM-5 Consult] Requesting complete production src/amm.rs from ${MODEL}...`);

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
                
                // Extract rust code block
                let rustCode = reply;
                if (reply.includes('```rust')) {
                    rustCode = reply.split('```rust')[1].split('```')[0].trim();
                } else if (reply.includes('```')) {
                    rustCode = reply.split('```')[1].split('```')[0].trim();
                }

                const targetFile = path.join(PROJECT_ROOT, 'src', 'amm.rs');
                fs.writeFileSync(targetFile, rustCode, 'utf8');

                console.log(`\n======================================================`);
                console.log(`SUCCESS! GLM-5 authored code written directly to:\n${targetFile}`);
                console.log(`======================================================\n`);
                console.log(rustCode);
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
