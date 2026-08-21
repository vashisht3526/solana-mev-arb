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

async function runComputeLatencyDebate() {
    console.log("⚔️ STARTING TRIPLE-MODEL DEBATE ON COMPUTE UNIT OPTIMIZATION & ZERO-COST LATENCY PHYSICS\n");

    const prompt = `
USER'S TWO CORE QUESTIONS:
1. COMPUTE UNIT (CU) OPTIMIZATION:
   "Once GLM-5 mentioned that to definitely get our transaction filled/included, we need to lower the compute units for the transaction. What is that mechanism, how does Solana scheduling work, why does setting exact CUs (e.g. 140k instead of default 200k/1.4M) dramatically increase fill priority and lower priority fee cost?"
2. ATOMIC LATENCY & ZERO-COST ARCHITECTURE:
   "What is the latency between buying on DEX A, converting to token, and selling on DEX B? If we are using free WebSockets (PumpPortal/DexScreener) and $0 infrastructure, how is it physically possible to beat latency, capture profitable spreads, and make money against private fiber HFT nodes?"

TASK FOR THE MODELS:
- Explain the exact Solana runtime mechanics: 
  * Why Solana validators schedule transactions based on (Priority Fee per CU) and account read/write locks.
  * Why buying on Dex A and selling on Dex B has ZERO inter-DEX latency on-chain (Atomic CPI single-transaction execution in 1 slot).
  * The difference between "Mempool frontrunning" (impossible on Solana without Jito) vs "Spatial pool dislocation persistence" on mid-caps (which last 1-5 seconds, well within free WebSocket windows).
`;

    // 1. Query GLM-5
    console.log("⚡ [Round 1/3] Querying GLM-5...");
    const glm5 = await queryModel("zai.glm-5", "You are GLM-5, lead Solana runtime & MEV architect.", prompt);
    fs.writeFileSync(path.join(__dirname, 'debate_cu_latency_glm5.md'), glm5);
    console.log("✅ GLM-5 response saved!");

    // 2. Query Kimi k2.5
    console.log("⚡ [Round 2/3] Querying Kimi k2.5 to critique & add quant latency metrics...");
    const kimi = await queryModel("moonshotai.kimi-k2.5", "You are Kimi k2.5, expert in low-latency systems and validator auction theory.", `GLM-5 Analysis:\n${glm5}\n\n${prompt}`);
    fs.writeFileSync(path.join(__dirname, 'debate_cu_latency_kimi.md'), kimi);
    console.log("✅ Kimi k2.5 response saved!");

    // 3. Query Qwen 3 Coder 480B
    console.log("⚡ [Round 3/3] Querying Qwen 3 Coder 480B for consensus synthesis...");
    const qwen = await queryModel("qwen.qwen3-coder-480b-a35b-instruct", "You are Qwen 3 Coder 480B, lead Solana core engineer.", `GLM-5:\n${glm5}\n\nKimi:\n${kimi}\n\nSynthesize the complete, definitive answer to the user.`);
    fs.writeFileSync(path.join(__dirname, 'debate_cu_latency_qwen_consensus.md'), qwen);
    console.log("✅ Qwen 3 Coder 480B consensus saved!");

    console.log("\n🎉 CU & Latency Debate Complete!");
}

runComputeLatencyDebate().catch(e => console.error(e));
