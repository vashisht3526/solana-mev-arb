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

async function run1SolLiveAnalysis() {
    console.log("🚀 CONSULTING GLM-5 + KIMI + QWEN ON 1 SOL LIVE REAL TRADING FEASIBILITY\n");

    const prompt = `
THE USER ASKS:
"Suppose if we implement live real trading in this system with only 1 SOL, will it make profit?"

Analyze this thoroughly and give an honest, mathematical, and institutional breakdown:
1. CAPITAL & SIZING REALITY:
   - With 1.0 SOL total balance, what should the position size be? (e.g. 0.15 - 0.25 SOL).
   - How does rent exemption (WSOL + temporary token ATA) affect available capital?
2. PROFIT VS GAS BURN MATH:
   - On winning trades with 0.20 SOL size and 1.5% spread: Gross profit = 0.003 SOL (~$0.27). Minus gas, priority fee, Jito tip = Net +0.0018 SOL.
   - On failed/reverted trades: Atomic invariant saves the 0.20 SOL principal, but burns 0.00005 - 0.0002 SOL priority fee.
   - What win rate is required to be net profitable?
3. COMPETITIVE LANDSCAPE (Free WebSockets vs Pro Searchers):
   - Where can a 1 SOL bot win on Solana? (Niche mid-cap meme coins, graduated Pump.fun/Raydium/Meteora/Orca pairs with $50k - $2M liquidity where tier-1 HFT bots don't compete vs major pairs where they dominate).
4. VERDICT & ACTIONABLE RECOMMENDATIONS:
   - Will it make profit with 1 SOL?
   - What exact settings, safety limits, and filters must be applied to guarantee 1 SOL survives and grows?
`;

    // 1. Query GLM-5
    console.log("⚡ [1/3] Querying GLM-5...");
    const glm5 = await queryModel("zai.glm-5", "You are GLM-5, lead quantitative financial engineer.", prompt);
    fs.writeFileSync(path.join(__dirname, 'sol1_glm5.md'), glm5);

    // 2. Query Kimi k2.5
    console.log("⚡ [2/3] Querying Kimi k2.5...");
    const kimi = await queryModel("moonshotai.kimi-k2.5", "You are Kimi k2.5, expert quant and risk management auditor.", `GLM-5 Analysis:\n${glm5}\n\n${prompt}`);
    fs.writeFileSync(path.join(__dirname, 'sol1_kimi.md'), kimi);

    // 3. Query Qwen 3 Coder 480B
    console.log("⚡ [3/3] Querying Qwen 3 Coder 480B for consensus synthesis...");
    const qwen = await queryModel("qwen.qwen3-coder-480b-a35b-instruct", "You are Qwen 3 Coder 480B, lead Solana systems engineer.", `GLM-5:\n${glm5}\n\nKimi:\n${kimi}\n\nSynthesize the complete, definitive answer to the user.`);
    fs.writeFileSync(path.join(__dirname, 'sol1_qwen_consensus.md'), qwen);

    console.log("🎉 1 SOL Analysis Complete!");
}

run1SolLiveAnalysis().catch(e => console.error(e));
