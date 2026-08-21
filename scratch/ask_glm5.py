import os
import json
import urllib.request
import urllib.error

MANTLE_BASE_URL = 'https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions'
MANTLE_BEARER_TOKEN = 'ABSKTWFudGxlQXBpS2V5LW95em9rNWttLWF0LTQwNDY4ODE5NTY3NzpEc0kwS3hxaGdrMm9hOHV1akM2eUlmOWdLRGJOV1Q0ZnpSckFzajl1NTB1OURBSXdCeGFiT0VpRGNGOD0='
MODEL = 'zai.glm-5'

PROJECT_ROOT = r'C:\Users\Vashisht\.gemini\antigravity\scratch\solana-mev-arb'

files_to_read = [
    'Cargo.toml',
    'src/main.rs',
    'src/amm.rs',
    'src/scanner.rs',
    'src/paper_engine.rs',
    'src/types.rs',
    'src/websocket_feed.rs',
    'src/jito.rs',
    'src/jito_builder.rs',
    'dashboard/server.js'
]

codebase_bundle = {}
for rel_path in files_to_read:
    full_path = os.path.join(PROJECT_ROOT, rel_path)
    if os.path.exists(full_path):
        with open(full_path, 'r', encoding='utf-8') as f:
            codebase_bundle[rel_path] = f.read()

system_prompt = """You are an elite Solana MEV Quantitative Researcher and High-Frequency Trading Systems Architect. 
You specialize in microsecond cross-DEX atomic arbitrage, constant-product & concentrated liquidity AMMs (Raydium CPMM/CLMM, Meteora DLMM, PumpSwap/Pump.fun bonding curves, Orca Whirlpools), and Jito block-engine bundle optimization.

You will be provided with the complete Rust source code and Node.js dashboard of a live Solana arbitrage engine.
Your objective: Provide a thorough, brutal, production-grade quantitative analysis and specific mathematical & architectural recommendations to MAXIMIZE NET PROFIT, WIN RATE, and OPPORTUNITY CAPTURE RATE while preserving zero inventory risk.
"""

user_prompt = f"""Here is the complete source code of our Solana Cross-DEX Arbitrage Engine:

"""

for path, code in codebase_bundle.items():
    user_prompt += f"==================== FILE: {path} ====================\n```rust\n{code}\n```\n\n"

user_prompt += """
Please analyze this codebase thoroughly and provide deep, actionable recommendations on:

1. OPTIMAL POSITION SIZING MATH:
   - Currently, we use `actual_swap_sol = min(base_swap_sol, (pool_liquidity * 0.03) / sol_price)`.
   - What is the exact closed-form mathematical formula for the *profit-maximizing trade size* $s^*$ between two constant-product AMM pools (Pool A with reserves $x_1, y_1$ and Pool B with reserves $x_2, y_2$) that maximizes net profit after quadratic slippage and fees?

2. LATENCY & EVENT PIPELINE IMPROVEMENTS:
   - How can we eliminate remaining latency bottlenecks between PumpPortal WebSocket swap events, DexScreener discovery, and Jito bundle generation?
   - How should we structure the in-memory pool state cache to achieve sub-millisecond evaluation without locks/blocking?

3. CROSS-DEX ARBITRAGE EXPANSION:
   - How can we add Meteora Dynamic AMM (DLMM bin math) and Raydium CLMM (tick math) into this exact engine to capture 5x-10x more multi-pool price discrepancies?

4. JITO BUNDLE & TIP OPTIMIZATION:
   - How should we dynamically price Jito tips based on market volatility, expected profit, and validator schedule to ensure >90% bundle landing rate without overpaying?

5. SPECIFIC CODE MODIFICATIONS & REFACTORS:
   - Provide concrete, production-ready Rust code snippets for the key math and scanner functions to directly upgrade this codebase.
"""

payload = {
    "model": MODEL,
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ],
    "max_tokens": 8192,
    "temperature": 0.3
}

data = json.dumps(payload).encode('utf-8')
headers = {
    "Authorization": f"Bearer {MANTLE_BEARER_TOKEN}",
    "Content-Type": "application/json"
}

req = urllib.request.Request(MANTLE_BASE_URL, data=data, headers=headers, method='POST')

print(f"Sending entire codebase ({len(user_prompt)} chars) to {MODEL} via Bedrock Mantle...")
try:
    with urllib.request.urlopen(req, timeout=120) as response:
        res_body = response.read().decode('utf-8')
        res_json = json.loads(res_body)
        reply = res_json['choices'][0]['message']['content']
        
        output_file = r'C:\Users\Vashisht\.gemini\antigravity\scratch\solana-mev-arb\scratch\glm5_profit_optimization_review.md'
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(reply)
            
        print(f"SUCCESS! GLM-5 analysis saved to: {output_file}")
        print("\n--- PREVIEW OF GLM-5 RECOMMENDATIONS ---")
        print(reply[:1000] + "...\n[Full report saved]")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
