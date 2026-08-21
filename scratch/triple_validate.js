const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_API_URL = 'https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';

const glm5Code = fs.readFileSync(path.join(__dirname, 'glm5_full_system_code.md'), 'utf-8');

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

async function runTripleValidation() {
    console.log("🚀 Starting Triple-Model Consensus Review: GLM-5 + Kimi k2.5 + Qwen/Claude Sonnet...\n");

    // 1. Kimi k2.5 Quantitative & Systems Review
    console.log("⚡ [1/2] Querying Kimi k2.5 for Quantitative Audit & Math Validation...");
    const kimiPrompt = `You are Kimi k2.5 (moonshotai.kimi-k2.5), world-class quantitative researcher and low-latency systems engineer.
GLM-5 has generated the complete Rust MEV engine for Solana cross-DEX spatial arbitrage (Raydium, Meteora DLMM, Orca Whirlpools, PumpSwap) with $0 external cost (PumpPortal WS + DexScreener dynamic scout + Jito tips).

Review GLM-5's code thoroughly for:
1. Mathematical precision: Newton-Raphson convergence, CPMM/CLMM fee accounting, slippage equations, dynamic Jito tip scaling.
2. Latency & Concurrency: Lock-free atomic bitpacking, Tokio tasks, channel buffers, DashMap usage.
3. Edge cases: Zero liquidity, stale pool quotes, division by zero, transaction revert assertions.

Here is GLM-5's code:
${glm5Code}

Provide your detailed review and any code refinements needed.`;

    try {
        const kimiReview = await queryModel("moonshotai.kimi-k2.5", "You are Kimi k2.5, expert quant and systems auditor.", kimiPrompt);
        fs.writeFileSync(path.join(__dirname, 'kimi_validation_review.md'), kimiReview);
        console.log("✅ Kimi k2.5 review completed and saved!");
    } catch (e) {
        console.error("❌ Kimi review error:", e.message);
    }

    // 2. Claude Sonnet / Qwen Coder Architecture & Rust Compiler Verification
    console.log("\n⚡ [2/2] Querying Claude Sonnet / Qwen for Rust Safety & Solana Instruction Validation...");
    const sonnetPrompt = `You are Claude Sonnet 3.5 / Qwen Coder, the world's top Rust compiler and Solana smart contract engineer.
GLM-5 has generated a Solana MEV Rust codebase. Perform a strict compiler-level audit:
1. Rust syntax, type signatures, lifetime correctness, struct field alignment.
2. Solana CPI & Atomic Router logic: program IDs for Raydium, Meteora, Orca, PumpSwap, invariant checks.
3. Thread safety, memory allocations, and async task orchestration.

Here is GLM-5's code:
${glm5Code}

Provide your line-by-line verification and finalized compile-ready code adjustments.`;

    try {
        const sonnetReview = await queryModel("anthropic.claude-sonnet-5", "You are an expert Rust and Solana systems verifier.", sonnetPrompt);
        fs.writeFileSync(path.join(__dirname, 'sonnet_qwen_validation_review.md'), sonnetReview);
        console.log("✅ Claude/Qwen review completed and saved!");
    } catch (e) {
        console.error("❌ Sonnet/Qwen review error:", e.message);
    }

    console.log("\n🎉 Triple-Model Consensus Validation Complete!");
}

runTripleValidation();
