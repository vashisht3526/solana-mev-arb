import urllib.request
import json
import time

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
endpoints = [
    'https://api.dexscreener.com/token-boosts/top/v1',
    'https://api.dexscreener.com/token-boosts/latest/v1',
    'https://api.dexscreener.com/token-profiles/latest/v1'
]

discovered_mints = set()
for ep in endpoints:
    try:
        req = urllib.request.Request(ep, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            for item in data:
                if item.get('chainId') == 'solana' and item.get('tokenAddress'):
                    discovered_mints.add(item.get('tokenAddress'))
    except Exception as e:
        print(f"Error fetching {ep}: {e}")

print(f"Total Discovered Fresh Volatile Tokens: {len(discovered_mints)}")

# Now test each to see how many have multiple pools (Raydium, PumpSwap, Meteora, Orca) with >= $1,500 liquidity
multi_pool_tokens = []
for mint in list(discovered_mints)[:30]:
    try:
        url = f"https://api.dexscreener.com/latest/dex/tokens/{mint}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            pairs = data.get('pairs', [])
            if not pairs:
                continue
            
            symbol = pairs[0].get('baseToken', {}).get('symbol', 'UNKNOWN')
            pools = {}
            for p in pairs:
                dex = p.get('dexId', '').lower()
                liq = p.get('liquidity', {}).get('usd', 0)
                price = float(p.get('priceUsd', 0) or 0)
                if liq >= 1500 and price > 0:
                    pools[dex] = {'price': price, 'liq': liq}
            
            if len(pools) >= 2:
                multi_pool_tokens.append({'symbol': symbol, 'mint': mint, 'pools': list(pools.keys())})
                print(f"✅ VOLATILE MULTI-POOL: {symbol} | Pools: {list(pools.keys())}")
        time.sleep(0.1)
    except Exception as e:
        pass

print(f"\nTotal Multi-Pool Volatile Coins ready for Arbitrage: {len(multi_pool_tokens)}")
