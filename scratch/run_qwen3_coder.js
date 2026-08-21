const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_API_URL = 'https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';

const glm5Code = fs.readFileSync(path.join(__dirname, 'glm5_full_system_code.md'), 'utf-8');
const kimiReview = fs.readFileSync(path.join(__dirname, 'kimi_validation_review.md'), 'utf-8');

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

async function runQwenCoderAudit() {
    console.log("⚡ Querying Qwen 3 Coder 480B (qwen.qwen3-coder-480b-a35b-instruct) for deep Rust compiler audit & instruction verification...\n");

    const qwenPrompt = `You are Qwen 3 Coder 480B (qwen.qwen3-coder-480b-a35b-instruct), the premier code synthesis and Rust systems verification model.

GLM-5 and Kimi k2.5 have architected a Solana MEV Cross-DEX Arbitrage engine in Rust (supporting Raydium CPMM/CLMM, Meteora DLMM, Orca Whirlpools, PumpSwap) with 0 API keys / free WebSockets.

Here is GLM-5's generated codebase:
\`\`\`rust
${glm5Code}
\`\`\`

Here is Kimi k2.5's quantitative review:
\`\`\`markdown
${kimiReview}
\`\`\`

YOUR TASK AS QWEN 3 CODER 480B:
1. Conduct a rigorous compiler-level syntax & memory audit on all structs, functions, and async channels.
2. Verify the lock-free TradeLockTable (atomic bitpacking with AtomicU64), ensure compare_exchange_weak memory ordering is valid (SeqCst / Relaxed).
3. Verify the multi-DEX AMM fee multipliers and invariant assertions.
4. Output the definitive, clean, and verified code for \`src/router.rs\`, \`src/amm.rs\`, and \`src/scanner.rs\`.`;

    try {
        const qwenResponse = await queryModel(
            "qwen.qwen3-coder-480b-a35b-instruct",
            "You are Qwen 3 Coder 480B, an elite Rust and Solana systems verification compiler engineer.",
            qwenPrompt
        );
        fs.writeFileSync(path.join(__dirname, 'qwen3_coder_validation_review.md'), qwenResponse);
        console.log("✅ Qwen 3 Coder 480B review successfully generated and saved! Length:", qwenResponse.length);
    } catch (e) {
        console.error("❌ Qwen Coder error:", e.message);
    }
}

runQwenCoderAudit();
