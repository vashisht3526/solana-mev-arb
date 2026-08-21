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

const userPrompt = `We are implementing the first component of our Kimi k2.5 math & AMM upgrade: **src/math.rs**.

Please generate the COMPLETE, fully compilable file **src/math.rs** implementing:
1. \`pub fn solve_optimal_arbitrage_newton(r_sol_a: f64, r_tok_a: f64, gamma_a: f64, r_sol_b: f64, r_tok_b: f64, gamma_b: f64, max_iterations: usize, tolerance: f64) -> Option<f64>\`: A numerically stable hybrid Newton-Raphson + Bisection optimal trade size solver with guaranteed convergence.
2. \`pub fn cpmm_output_exact(reserve_in: u128, reserve_out: u128, amount_in: u128, fee_bps: u32) -> Option<u128>\`: Exact integer constant-product output with overflow protection.
3. \`pub fn calculate_price_impact(reserve_in: f64, reserve_out: f64, amount_in: f64, fee_multiplier: f64) -> f64\`: Price impact calculator.

Return ONLY the complete raw Rust code for **src/math.rs** enclosed in \`\`\`rust ... \`\`\`. No placeholders, no pseudocode.`;

const payload = JSON.stringify({
    model: MODEL,
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ],
    max_tokens: 4096,
    temperature: 0.2
});

console.log(`[Kimi k2.5 Consult] Requesting complete production src/math.rs from ${MODEL}...`);

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

                const targetFile = path.join(PROJECT_ROOT, 'src', 'math.rs');
                fs.writeFileSync(targetFile, rustCode, 'utf8');

                console.log(`\n======================================================`);
                console.log(`SUCCESS! Kimi k2.5 authored code written directly to:\n${targetFile}`);
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
