const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_API_URL = 'https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';

const walletDump = fs.readFileSync(path.join(__dirname, 'wallet_1.8m_onchain_dump.json'), 'utf-8');

const prompt = `You are GLM-5 (zai.glm-5), the world-renowned quantitative researcher, reverse-engineering specialist, and high-frequency Solana MEV architect.

We have extracted live on-chain transactions and runtime logs from the top-performing $1.8M profit Solana MEV arbitrage wallet:
Target Wallet: MRiYA4oN3158fCV8evhuCofrDzbHyYvYnGZUDJvoCsa

Here is the raw on-chain transaction dump (including slots, program IDs, instructions, atomic reverts, gas fees, and DEX invocations):
\`\`\`json
${walletDump}
\`\`\`

Please perform a comprehensive, deep-dive forensic analysis:
1. TRADING STYLE & MECHANICS:
   - What exact arbitrage strategy is this wallet executing? (2-leg spatial, 3-leg cyclic, DLMM backrun, Pump.fun to Raydium/Orca/Meteora).
   - How does it use its custom on-chain contract (AN225ksocfZpbPVEbwffiANbtUdYbySM3WJ6dbsYAqij)?
   - Why do ~30-40% of transactions intentionally revert with 0 token loss? Explain the atomic assertion invariant.

2. SYSTEM ARCHITECTURE & LATENCY PROFILE:
   - Explain its off-chain vs on-chain split (Geyser gRPC stream, Rust async engine, on-chain Anchor/native router).
   - How does it achieve multi-tx block packing across slots (e.g. 7 transactions submitted to slot 440668860 within milliseconds)?
   - Compute budget, priority fee, and Jito bundling mechanics.

3. HOW WE CAN CLONE & ADAPT THIS SYSTEM:
   - Complete technical blueprint for our Rust MEV bot to mirror this $1.8M wallet's exact architecture.
   - On-chain contract structure (Anchor/Pinocchio router for atomic multi-DEX swaps).
   - Off-chain Geyser pipeline and optimal position sizing.
   - Actionable implementation roadmap.

Provide a thorough, highly technical, and exhaustive report.`;

const postData = JSON.stringify({
    model: "zai.glm-5",
    messages: [
        { role: "system", content: "You are GLM-5, the leading Solana MEV and quantitative systems architect." },
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
                fs.writeFileSync(path.join(__dirname, 'glm5_1.8m_wallet_forensic_report.md'), answer);
                console.log("GLM-5 1.8M Wallet Forensic Report saved successfully!");
                console.log("Length:", answer.length);
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
