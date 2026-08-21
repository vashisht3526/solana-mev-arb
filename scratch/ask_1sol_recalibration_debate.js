const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_API_URL = 'https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';

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

async function run1SolRecalibrationDebate() {
    console.log("⚙️ STARTING 1.0 SOL ENGINE RECALIBRATION DEBATE (GLM-5 + KIMI + QWEN)\n");

    const prompt = `
TASK: RECALIBRATE THE SOLANA MEV ARBITRAGE BOT FROM 10.0 SOL TO 1.0 SOL BANKROLL.

We need to optimize all constants, math functions, position sizing, and thresholds across the codebase:
1. STARTING CAPITAL & BALANCE:
   - Reset virtual wallet balance from 10.00 SOL to 1.0000 SOL.
2. POSITION SIZING FOR 1.0 SOL:
   - Previously: MAX_POSITION_SOL = 0.50 SOL (5% of 10 SOL).
   - For 1.0 SOL: What should MAX_POSITION_SOL and MIN_POSITION_SOL be? (e.g. Max 0.15 SOL, Min 0.02 SOL to allow concurrent arbs and protect gas runway).
3. PROFIT & SPREAD THRESHOLDS FOR 1.0 SOL:
   - MIN_NET_PROFIT_SOL: What is the optimal floor? (e.g. 0.00008 SOL / 80k lamports to capture small micro-arbs that still beat gas).
   - MIN_SPREAD_PCT: (e.g. 0.35% - 15.00%).
4. GAS & JITO TIP BUDGETING:
   - Base gas: 0.000005 SOL
   - Priority fee: 0.0001 - 0.0003 SOL (scaled for 110k CUs)
   - Dynamic Jito tip: 20% of net margin, clamped [0.00005, 0.01].
5. PROVIDE EXACT RUST CODE CHANGES for:
   - src/main.rs
   - src/paper_engine.rs
   - src/amm.rs
   - src/scanner.rs
`;

    // 1. Query GLM-5
    console.log("⚡ [1/3] Querying GLM-5 for 1.0 SOL parameter tuning...");
    const glm5 = await queryModel("zai.glm-5", "You are GLM-5, lead quantitative financial engineer.", prompt);
    fs.writeFileSync(path.join(__dirname, 'recalibrate_glm5.md'), glm5);
    console.log("✅ GLM-5 response saved!");

    // 2. Query Kimi k2.5
    console.log("⚡ [2/3] Querying Kimi k2.5 for quant risk checks & sizing bounds...");
    const kimi = await queryModel("moonshotai.kimi-k2.5", "You are Kimi k2.5, expert quant and risk management auditor.", `GLM-5 Proposal:\n${glm5}\n\n${prompt}`);
    fs.writeFileSync(path.join(__dirname, 'recalibrate_kimi.md'), kimi);
    console.log("✅ Kimi k2.5 response saved!");

    // 3. Query Qwen 3 Coder 480B
    console.log("⚡ [3/3] Querying Qwen 3 Coder 480B for finalized consensus Rust code...");
    const qwen = await queryModel("qwen.qwen3-coder-480b-a35b-instruct", "You are Qwen 3 Coder 480B, lead Rust compiler engineer.", `GLM-5:\n${glm5}\n\nKimi:\n${kimi}\n\nProvide the finalized, compile-ready Rust code for src/main.rs, src/paper_engine.rs, src/amm.rs, and src/scanner.rs.`);
    fs.writeFileSync(path.join(__dirname, 'recalibrate_qwen_consensus.md'), qwen);
    console.log("✅ Qwen 3 Coder 480B consensus saved!");

    console.log("\n🎉 1.0 SOL Recalibration Debate Complete!");
}

run1SolRecalibrationDebate().catch(e => console.error(e));
