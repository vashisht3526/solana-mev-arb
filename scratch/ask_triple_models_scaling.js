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

async function runTriModelDiscussion() {
    console.log("🚀 STARTING TRIPLE-MODEL ROUNDTABLE: GLM-5 + Kimi k2.5 + Qwen 3 Coder 480B\n");

    const userThesis = `
THE USER'S QUESTION & THESIS:
"Why is the engine still trading so rarely (e.g. only 13 active tokens, only a few trades per hour)?
Shouldn't we be tracking 100 to 300+ volatile Solana tokens across multi-DEX pools and evaluating spreads aggressively in parallel?
Because with our atomic router invariant (require!(final_sol >= input_sol + min_profit)), if an arb fails or gets front-run, we suffer ZERO token principal loss (and in paper trading 0 loss, live trading only 0.000005 SOL gas).
So why are we restricting ourselves to only 13 tokens? Why not expand the tracked universe to 100-300 tokens, parallelize the auditor across Raydium/Meteora/Orca/Pump, lower unnecessary artificial throttles, and catch 50x-100x more real spread opportunities?"

CURRENT src/scanner.rs:
\`\`\`rust
${scannerCode}
\`\`\`

CURRENT src/amm.rs:
\`\`\`rust
${ammCode}
\`\`\`
`;

    // 1. Query GLM-5
    console.log("⚡ [1/3] Querying GLM-5 (zai.glm-5) for scaling thesis & architecture proposal...");
    const glm5Response = await queryModel(
        "zai.glm-5",
        "You are GLM-5, lead quantitative systems architect. Answer the user's scaling thesis in depth and propose the concrete architecture and Rust code improvements to scale tracking to 100-300 tokens with high-frequency parallel evaluation.",
        userThesis
    );
    fs.writeFileSync(path.join(__dirname, 'discussion_glm5.md'), glm5Response);
    console.log("✅ GLM-5 responded and saved!");

    // 2. Query Kimi k2.5 to validate GLM-5's proposal
    console.log("\n⚡ [2/3] Querying Kimi k2.5 (moonshotai.kimi-k2.5) to validate GLM-5 and add quantitative constraints...");
    const kimiPrompt = `
Here is GLM-5's response to the user's scaling thesis:
\`\`\`markdown
${glm5Response}
\`\`\`

Evaluate GLM-5's proposal:
1. Is the user's thesis 100% correct regarding atomic safety and universe expansion (100-300 tokens)?
2. What are the rate-limit, concurrency, and memory considerations when scaling from 13 tokens to 200+ tokens with $0 external cost (DexScreener batching, Raydium/PumpPortal WS, Tokio worker pools)?
3. Provide your quantitative refinements and validate or adjust GLM-5's code recommendations.
`;
    const kimiResponse = await queryModel(
        "moonshotai.kimi-k2.5",
        "You are Kimi k2.5, expert quant and low-latency systems auditor. Cross-validate GLM-5's scaling proposal.",
        kimiPrompt
    );
    fs.writeFileSync(path.join(__dirname, 'discussion_kimi.md'), kimiResponse);
    console.log("✅ Kimi k2.5 responded and saved!");

    // 3. Query Qwen 3 Coder 480B to synthesize and generate final unified code
    console.log("\n⚡ [3/3] Querying Qwen 3 Coder 480B (qwen.qwen3-coder-480b-a35b-instruct) to synthesize consensus and write production Rust code...");
    const qwenPrompt = `
You have the consensus of GLM-5 and Kimi k2.5 regarding scaling the Solana MEV Arbitrage Engine to 100-300 tokens:

GLM-5 PROPOSAL:
\`\`\`markdown
${glm5Response}
\`\`\`

KIMI K2.5 QUANTITATIVE AUDIT:
\`\`\`markdown
${kimiResponse}
\`\`\`

SYNTHESIS TASK:
Synthesize both models' conclusions into a finalized, production-ready \`src/scanner.rs\` that:
1. Expands token admission to 100-300 tokens by querying multiple discovery sources (Top boosts, latest profiles, Raydium top volume, Meteora top volume, Pump.fun graduates).
2. Uses Tokio concurrent task spawning (\`futures::stream::iter\` with \`buffer_unordered(32)\`) in \`run_volatility_auditor\` so all 200+ tokens are audited simultaneously in parallel every 2-3 seconds rather than slow sequential sleep loops!
3. Retains the atomic TradeLockTable and Newton-Raphson safety bounds.
4. Outputs the complete, drop-in, compile-ready \`src/scanner.rs\`.
`;
    const qwenResponse = await queryModel(
        "qwen.qwen3-coder-480b-a35b-instruct",
        "You are Qwen 3 Coder 480B, lead Rust systems compiler engineer. Synthesize GLM-5 and Kimi k2.5 into finalized production code.",
        qwenPrompt
    );
    fs.writeFileSync(path.join(__dirname, 'discussion_qwen3_consensus.md'), qwenResponse);
    console.log("✅ Qwen 3 Coder 480B finalized consensus code successfully saved!");
    console.log("\n🎉 Roundtable Discussion & Code Synthesis Complete!");
}

runTriModelDiscussion().catch(e => console.error("Roundtable error:", e));
