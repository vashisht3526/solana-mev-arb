const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_API_URL = 'https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';

function readFile(p) {
    return fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
}

const scannerCode = readFile('src/scanner.rs');
const ammCode = readFile('src/amm.rs');
const wsCode = readFile('src/websocket_feed.rs');

const prompt = `You are GLM-5 (zai.glm-5), the world-class quantitative finance and high-frequency trading systems architect.
The user is asking: "why is the system not trading? Diagnose and fix it."

Here is the current live production status on our Frankfurt AWS EC2 server:
Logs:
"📊 [STREAMING MEV ENGINE] Active Tokens: 13 | Pools Scanned: 4640 | Arbs Eval: 0 | Opps: 0 | Trades: 0 | Wins: 0 | Fails: 0 | Win Rate: 0.0% | PnL: +0.0000 SOL | Balance: 10.0000 SOL"
"🔥 [SCOUT ADMITTED] HBULL, STONK, AVICI, TOAD, MADE, catalyst, MANLET, BULLSHIT, Jimothy, YESDOG, GTA6, Jotchua, MEMEFI"

OBSERVED ISSUES IN THE CODE:
1. In src/scanner.rs, 'Arbs Eval' is 0 because 'handle_onchain_swap' ONLY evaluates when a trade comes in on PumpPortal WebSocket for that exact mint. But the 13 multi-DEX tokens (e.g. STONK, MADE, MANLET) trade mostly on Raydium/Meteora/Orca, not on Pump.fun bonding curves, OR the WebSocket stream has thousands of other tokens so trades for the 13 tracked tokens are rare.
2. In 'run_volatility_auditor', it fetches updated DEX pool prices via DexScreener every 15 seconds, but IT NEVER RUNS 'evaluate_optimal_arbitrage' between the pairs! It only stores the updated pools into the registry without checking cross-DEX arbitrage opportunities between Raydium, Meteora, PumpSwap, and Orca!
3. In 'handle_onchain_swap', it only checks 'pump_pool vs other pools', ignoring 'Raydium vs Meteora', 'Raydium vs Orca', 'Meteora vs Orca', etc.!

Please analyze the codebase, explain clearly in detail why the system is not executing trades, and write the complete, optimized, production-ready Rust code for src/scanner.rs that evaluates all pool pairs (Raydium, Meteora, PumpSwap, Orca) both on live WebSocket swaps AND during every volatility audit tick!

Here is src/scanner.rs:
\`\`\`rust
${scannerCode}
\`\`\`

Here is src/amm.rs:
\`\`\`rust
${ammCode}
\`\`\`
`;

const postData = JSON.stringify({
    model: "zai.glm-5",
    messages: [
        { role: "system", content: "You are GLM-5, an expert quantitative researcher and Rust systems architect for Solana MEV arbitrage engines." },
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
    timeout: 120000
}, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.choices && json.choices.length > 0) {
                const answer = json.choices[0].message.content;
                fs.writeFileSync(path.join(__dirname, 'glm5_diagnosis_response.md'), answer);
                console.log("GLM-5 diagnosis response saved successfully!");
                console.log("First 500 chars:\n", answer.substring(0, 500));
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
