const fs = require('fs');
const path = require('path');
const https = require('https');

const MANTLE_BASE_URL = 'bedrock-mantle.us-east-1.api.aws';
const MANTLE_PATH = '/v1/chat/completions';
const MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0=';
const MODEL = 'moonshotai.kimi-k2.5';

const PROJECT_ROOT = 'C:\\Users\\Vashisht\\.gemini\\antigravity\\scratch\\solana-mev-arb';

const systemPrompt = `You are a Principal High-Frequency Trading Systems Architect and Solana MEV Specialist.
You design ultra-low latency, lock-free, zero-allocation multi-threaded trading systems in Rust for sub-millisecond execution on Solana mainnet.`;

const userPrompt = `The user asked: "don't just consult for math, but also for system design, architecture improvements".

We need a complete **System Design & Architecture Refactor** for our Solana MEV Arbitrage Engine:

### Architectural Goals:
1. **Zero-Lock Hot Path**:
   - Eliminate all mutex/RwLock contention during live swap evaluation.
   - Use atomic operations (\`AtomicU64\`, \`AtomicBool\`) and \`ArcSwap\` or \`DashMap\` with lock-free atomic cooldown checks (\`try_acquire_trade_lock\`).
2. **Backpressure-Free High-Throughput Event Ingestion**:
   - Upgrade \`src/websocket_feed.rs\` with a bounded crossbeam channel and ring buffer to prevent event drops during market surges.
3. **Multi-Worker Pipeline Architecture**:
   - Decouple Network I/O (WebSocket ingestion) from Evaluation Workers (pure CPU math) and Execution (paper/live Jito bundle submission).
4. **Multi-Pool & Triangular Routing Support**:
   - Architect the system to evaluate 2-pool spatial arbs (Pump.fun <-> Raydium/Meteora) AND 3-pool triangular arbs.
5. **Resilient Background Discovery & Pool State Refresher**:
   - Clean separation of background scout/auditor from the ultra-fast in-memory swap stream.

Please provide:
1. The **Comprehensive System Architecture Design** explaining the pipeline flow, threading model, memory layout, and latency budget (<50 microseconds hot path).
2. Complete, production-ready Rust code for **src/scanner.rs** implementing this multi-worker, lock-free architecture.
3. Complete, production-ready Rust code for **src/websocket_feed.rs** with zero-loss buffering.

Enclose all code blocks clearly in \`\`\`rust ... \`\`\`. No placeholders.`;

const payload = JSON.stringify({
    model: MODEL,
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ],
    max_tokens: 8192,
    temperature: 0.2
});

console.log(`[Kimi k2.5 System Design Consult] Requesting complete architectural refactor from ${MODEL}...`);

const options = {
    hostname: MANTLE_BASE_URL,
    port: 443,
    path: MANTLE_PATH,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${MANTLE_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => { responseData += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const parsed = JSON.parse(responseData);
                const reply = parsed.choices[0].message.content;
                
                const outputFile = path.join(PROJECT_ROOT, 'scratch', 'kimi_system_architecture_design.md');
                fs.writeFileSync(outputFile, reply, 'utf8');

                console.log(`\n======================================================`);
                console.log(`SUCCESS! Kimi k2.5 System Architecture saved to:\n${outputFile}`);
                console.log(`======================================================\n`);
                console.log(reply.substring(0, 1500) + '...\n\n[Full architecture saved to file]');
            } catch (err) {
                console.error('JSON Parse Error:', err, responseData);
            }
        } else {
            console.error(`HTTP Error ${res.statusCode}:`, responseData);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e);
});

req.write(payload);
req.end();
