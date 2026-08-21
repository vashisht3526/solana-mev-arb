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

function queryModel(modelName, systemPrompt, userPrompt) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: modelName,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.15,
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
                        resolve(json.choices[0].message.content);
                    } else {
                        reject(new Error("API error: " + data));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function runTriModelVelocityAudit() {
    console.log("🚀 STARTING TRIPLE-MODEL VELOCITY & PROFIT MAXIMIZATION AUDIT\n");

    const prompt = `
CRITICAL PRODUCTION BOTTLENECK DISCOVERED:
Live Server Status on Frankfurt EC2:
"📊 [STREAMING MEV ENGINE] Active Tokens: 56 | Pools Scanned: 101,412 | Arbs Eval: 95 | Opps: 0 | Trades: 0 | PnL: +0.0000 SOL | Balance: 10.0000 SOL"

ROOT CAUSE ANALYSIS:
1. In src/scanner.rs:
   In TradeLockTable::try_acquire_lock:
   \`\`\`rust
   let global_last = self.global_last_trade.load(Ordering::Relaxed);
   if now.saturating_sub(global_last) < GLOBAL_COOLDOWN_MS {
       return false; // BLOCKS EVALUATION!
   }
   \`\`\`
   'global_last_trade' was being updated and checked during the ARBITRAGE EVALUATION loop instead of during actual TRADE EXECUTION. When 56 tokens are evaluated in parallel, Token #1 sets global_last_trade = now, and the remaining 55 tokens are immediately BLOCKED and aborted! That's why 101,412 pools were scanned, but only 95 arbs were ever evaluated!

2. SPREAD THRESHOLDS & MIN PROFIT:
   In src/amm.rs:
   - MIN_SPREAD_PCT is 0.50%. Real-world micro-arbitrage on high volume pools often occurs at 0.15% - 0.40% net spreads.
   - MIN_NET_PROFIT_SOL is 0.0003 SOL. With 0.50 SOL position sizes, small 0.0001 SOL gains compound quickly.

3. EVALUATION DEDUPLICATION:
   In src/scanner.rs:
   \`last_known_prices\` checks if the exact (buy_price, sell_price) matches. If a spread persists for 10 seconds, only 1 trade fires and then it never checks again until prices move.

USER DIRECTIVE:
"Bro it is still sitting on 44 dollars of profit. Consult all the models to start increasing trades and profit!"

TASK FOR TRIPLE CONSENSUS:
1. Provide the exact, optimized architecture to fix the lock contention and unleash ultra-high-frequency parallel evaluations (thousands of arbs evaluated per second across all 50-150 tokens).
2. Optimize spread thresholds, dynamic position sizing, and trade execution triggers so the engine captures dozens of profitable trades per hour while maintaining the atomic assertion invariant (require!(final_sol >= input_sol + min_profit)).
3. Provide the complete, compile-ready Rust code for src/scanner.rs and src/amm.rs.
`;

    // 1. Query GLM-5
    console.log("⚡ [1/3] Querying GLM-5 for velocity & profit scaling solution...");
    const glm5 = await queryModel("zai.glm-5", "You are GLM-5, lead quantitative MEV architect.", prompt);
    fs.writeFileSync(path.join(__dirname, 'velocity_glm5.md'), glm5);
    console.log("✅ GLM-5 response saved!");

    // 2. Query Kimi k2.5
    console.log("\n⚡ [2/3] Querying Kimi k2.5 for quantitative validation & sizing optimization...");
    const kimiPrompt = `GLM-5 has proposed the following velocity fix:\n\n${glm5}\n\nValidate GLM-5's code and provide your quantitative refinements for optimal trade execution velocity and profit accumulation.`;
    const kimi = await queryModel("moonshotai.kimi-k2.5", "You are Kimi k2.5, expert quant and low-latency auditor.", kimiPrompt);
    fs.writeFileSync(path.join(__dirname, 'velocity_kimi.md'), kimi);
    console.log("✅ Kimi k2.5 response saved!");

    // 3. Query Qwen 3 Coder 480B
    console.log("\n⚡ [3/3] Querying Qwen 3 Coder 480B for finalized production code synthesis...");
    const qwenPrompt = `Synthesize GLM-5 and Kimi k2.5 into finalized, drop-in, compile-ready Rust code for src/scanner.rs and src/amm.rs:\n\nGLM-5:\n${glm5}\n\nKIMI:\n${kimi}`;
    const qwen = await queryModel("qwen.qwen3-coder-480b-a35b-instruct", "You are Qwen 3 Coder 480B, lead Rust systems compiler engineer.", qwenPrompt);
    fs.writeFileSync(path.join(__dirname, 'velocity_qwen3_consensus.md'), qwen);
    console.log("✅ Qwen 3 Coder 480B consensus code saved!");

    console.log("\n🎉 Velocity Audit Complete!");
}

runTriModelVelocityAudit().catch(e => console.error("Velocity audit error:", e));
