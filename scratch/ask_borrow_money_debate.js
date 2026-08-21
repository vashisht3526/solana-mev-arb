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

async function runBorrowMoneyDebate() {
    console.log("🛑 STARTING ETHICAL & QUANTITATIVE REALITY DEBATE ON BORROWING MONEY FOR LIVE TRADING\n");

    const prompt = `
USER'S SITUATION & QUESTION:
"so bro if our bot is that much efficient can i put real money into it, right now i have only 30 dollars should i borrow another 70 from someone and put into it, because bro i am in very real need of money another debate on this. should i put money on it or not yet?"

YOUR MANDATE AS A FINANCIAL & QUANTITATIVE RISK BOARD:
1. Provide an unequivocal, direct, and honest verdict: SHOULD THE USER BORROW MONEY TO PUT INTO THIS BOT?
2. Explain why borrowing money or using survival money for high-frequency MEV trading is catastrophic:
   - Expected daily yield on $100 (0.7 SOL) is small (~$0.30 - $1.00/day), NOT immediate life-saving money.
   - Gas burn, RPC drop-outs, network congestion, and unexpected slippage can slowly eat into capital before profits accumulate.
   - Emotional pressure and debt obligation ruin rational decision-making.
3. What is the responsible, professional pathway?
   - Continue running paper-trading / live shadow validation for free on AWS EC2.
   - Only ever deploy risk capital that is 100% disposable and unborrowed.
`;

    // 1. Query GLM-5
    console.log("⚡ [1/3] Querying GLM-5...");
    const glm5 = await queryModel("zai.glm-5", "You are GLM-5, lead quantitative financial risk director.", prompt);
    fs.writeFileSync(path.join(__dirname, 'borrow_debate_glm5.md'), glm5);

    // 2. Query Kimi k2.5
    console.log("⚡ [2/3] Querying Kimi k2.5...");
    const kimi = await queryModel("moonshotai.kimi-k2.5", "You are Kimi k2.5, expert quant risk auditor.", `GLM-5:\n${glm5}\n\n${prompt}`);
    fs.writeFileSync(path.join(__dirname, 'borrow_debate_kimi.md'), kimi);

    // 3. Query Qwen 3 Coder 480B
    console.log("⚡ [3/3] Querying Qwen 3 Coder 480B...");
    const qwen = await queryModel("qwen.qwen3-coder-480b-a35b-instruct", "You are Qwen 3 Coder 480B, lead engineer and financial risk judge.", `GLM-5:\n${glm5}\n\nKimi:\n${kimi}\n\nSynthesize the complete, definitive answer.`);
    fs.writeFileSync(path.join(__dirname, 'borrow_debate_qwen_consensus.md'), qwen);

    console.log("🎉 Borrow Money Debate Complete!");
}

runBorrowMoneyDebate().catch(e => console.error(e));
