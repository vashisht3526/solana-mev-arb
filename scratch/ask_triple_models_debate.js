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
            temperature: 0.25,
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

async function runFrontierDebate() {
    console.log("⚔️ STARTING HARD-HITTING TRIPLE-MODEL DEBATE ON EQUITY SAFETY & $1.8M BOT COMPETITION\n");

    const coreQuestions = `
THE USER'S CRITICAL QUESTIONS:
1. "Can you verify that we will get NO LOSS of equity except gas fee, and even if 100 transactions fail in a row, we are still just down on gas fee (e.g. 0.03 SOL) and not more?"
2. "Will our paper trading success rate hold in live real trading, or what will the real success rate be?"
3. "Can this 1 SOL bot with $0 free WebSockets actually compete with the top institutional bots like the $1.8M wallet (MRiYA4oN3158fCV8evhuCofrDzbHyYvYnGZUDJvoCsa), and can it ever reach that level of profitability?"

INSTRUCTIONS FOR THE MODELS:
Be brutally honest, mathematically exact, and do not sugarcoat anything.
Challenge assumptions, analyze on-chain bytecode invariants, latency physics, and MEV game theory.
`;

    // Round 1: GLM-5 Initial Thesis
    console.log("⚡ [Round 1/3] Querying GLM-5 for technical & game-theoretic analysis...");
    const glm5Thesis = await queryModel(
        "zai.glm-5",
        "You are GLM-5, lead quantitative financial engineer and Solana systems architect. Provide a rigorous, uncompromised analysis of the user's questions.",
        coreQuestions
    );
    fs.writeFileSync(path.join(__dirname, 'debate_round1_glm5.md'), glm5Thesis);
    console.log("✅ GLM-5 Round 1 saved!");

    // Round 2: Kimi k2.5 Counter-Audit & Challenge
    console.log("\n⚡ [Round 2/3] Querying Kimi k2.5 to attack GLM-5's points and provide risk reality checks...");
    const kimiPrompt = `
Here is GLM-5's analysis:
\`\`\`markdown
${glm5Thesis}
\`\`\`

YOUR TASK AS KIMI K2.5:
1. Attack any unrealistic claims in GLM-5's thesis.
2. Mathematically verify the "100 failed transactions" gas burn scenario vs 1.0 SOL capital.
3. Compare the physics of a 1 SOL bot on free WebSockets vs the $1.8M wallet on dedicated Geyser/TPU infrastructure.
4. Define the exact, realistic performance boundary of our system.
`;
    const kimiCritique = await queryModel(
        "moonshotai.kimi-k2.5",
        "You are Kimi k2.5, expert quant risk auditor and MEV latency physicist. Challenge GLM-5 and expose all hidden risks.",
        kimiPrompt
    );
    fs.writeFileSync(path.join(__dirname, 'debate_round2_kimi.md'), kimiCritique);
    console.log("✅ Kimi k2.5 Round 2 saved!");

    // Round 3: Qwen 3 Coder 480B Final Verdict & Consensus Synthesis
    console.log("\n⚡ [Round 3/3] Querying Qwen 3 Coder 480B to judge the debate and deliver the final verdict...");
    const qwenPrompt = `
You are the Chief Judge presiding over the debate between GLM-5 and Kimi k2.5 on live Solana MEV reality:

GLM-5 THESIS:
\`\`\`markdown
${glm5Thesis}
\`\`\`

KIMI K2.5 RISK AUDIT & ATTACK:
\`\`\`markdown
${kimiCritique}
\`\`\`

YOUR TASK AS QWEN 3 CODER 480B:
Synthesize the final, definitive, and unvarnished truth for the user:
1. Is equity 100% safe from principal loss on 100 failed transactions? (Explain the on-chain CPI revert guarantee and any edge cases like honeypot taxes).
2. What will the REAL win rate be in live trading vs paper trading?
3. Can a 1 SOL bot make $1.8M or compete head-to-head with the $1.8M bot? Give the exact mathematical capital trajectory.
4. Give the final actionable verdict.
`;
    const qwenVerdict = await queryModel(
        "qwen.qwen3-coder-480b-a35b-instruct",
        "You are Qwen 3 Coder 480B, lead Solana runtime engineer and MEV judge. Deliver the definitive verdict.",
        qwenPrompt
    );
    fs.writeFileSync(path.join(__dirname, 'debate_round3_qwen_verdict.md'), qwenVerdict);
    console.log("✅ Qwen 3 Coder 480B Final Verdict saved!");

    console.log("\n🎉 Frontier Model Debate Complete!");
}

runFrontierDebate().catch(e => console.error(e));
