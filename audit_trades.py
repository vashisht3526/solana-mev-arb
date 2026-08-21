import json
from collections import Counter

trades = [json.loads(l) for l in open('/home/ubuntu/solana-mev-arb/data/paper_trades.ndjson')]
ts = [t['timestamp_ms'] for t in trades]

print('=== TRADE LOG DEEP AUDIT ===')
print(f'Total trades: {len(trades)}')
print(f'Time range: {trades[0]["iso_time"]} to {trades[-1]["iso_time"]}')
print(f'Duration hours: {(max(ts) - min(ts)) / 1000 / 3600:.2f}')
print()

# Trades per minute
mins = Counter(t // 60000 for t in ts)
print(f'Unique minutes with trades: {len(mins)}')
print(f'Avg trades per active minute: {len(trades) / len(mins):.1f}')
print(f'Max trades in 1 minute: {max(mins.values())}')
print()

# Cluster sizes (same millisecond)
clusters = Counter(ts)
sizes = sorted(clusters.values(), reverse=True)
print(f'Total unique timestamps: {len(clusters)}')
print(f'Max trades at same millisecond: {sizes[0]}')
print(f'Avg trades per timestamp: {len(trades) / len(clusters):.1f}')
print()

# Bogus prices
bogus = [t for t in trades if t['entry_pump_price_usd'] > 100]
print(f'Bogus price trades (entry > $100): {len(bogus)}')
if bogus:
    for b in bogus[:5]:
        print(f'  {b["symbol"]}: entry=${b["entry_pump_price_usd"]} exit=${b["exit_raydium_price_usd"]} spread={b["gross_spread_pct"]}%')
print()

# Losses
losses = [t for t in trades if t['net_pnl_sol'] <= 0]
print(f'Losing trades: {len(losses)}')
print(f'Win rate: {(len(trades)-len(losses))/len(trades)*100:.1f}%')
print()

# Check if spreads are realistic
print('=== SPREAD DISTRIBUTION ===')
spreads = sorted([t['gross_spread_pct'] for t in trades])
print(f'Min spread: {spreads[0]:.2f}%')
print(f'10th percentile: {spreads[len(spreads)//10]:.2f}%')
print(f'25th percentile: {spreads[len(spreads)//4]:.2f}%')
print(f'Median spread: {spreads[len(spreads)//2]:.2f}%')
print(f'75th percentile: {spreads[3*len(spreads)//4]:.2f}%')
print(f'90th percentile: {spreads[9*len(spreads)//10]:.2f}%')
print(f'Max spread: {spreads[-1]:.2f}%')
print()

# Check timing gaps
print('=== TIMING ANALYSIS ===')
sorted_ts = sorted(ts)
gaps = [sorted_ts[i+1] - sorted_ts[i] for i in range(len(sorted_ts)-1)]
gaps = [g for g in gaps if g > 0]  # skip same-ms trades
if gaps:
    print(f'Unique positive gaps: {len(gaps)}')
    print(f'Min gap between trades: {min(gaps)}ms')
    print(f'Avg gap: {sum(gaps)/len(gaps):.0f}ms ({sum(gaps)/len(gaps)/1000:.1f}s)')
    print(f'Max gap: {max(gaps)}ms ({max(gaps)/1000:.0f}s)')
print()

# Check if prices are being randomly generated or truly from DexScreener
print('=== PRICE REALISM CHECK ===')
fart_trades = [t for t in trades if 'Fartcoin' in t['symbol']]
print(f'Fartcoin trades: {len(fart_trades)}')
fart_entries = set(round(t['entry_pump_price_usd'], 6) for t in fart_trades if t['entry_pump_price_usd'] < 100)
fart_exits = set(round(t['exit_raydium_price_usd'], 6) for t in fart_trades if t['exit_raydium_price_usd'] < 100)
print(f'Unique Fartcoin entry prices: {len(fart_entries)}')
print(f'Unique Fartcoin exit prices: {len(fart_exits)}')
print(f'Entry price samples: {sorted(list(fart_entries))[:10]}')
print(f'Exit price samples: {sorted(list(fart_exits))[:10]}')

wif_trades = [t for t in trades if t['symbol'] == '$WIF']
print(f'\nWIF trades: {len(wif_trades)}')
wif_entries = set(round(t['entry_pump_price_usd'], 6) for t in wif_trades)
wif_exits = set(round(t['exit_raydium_price_usd'], 6) for t in wif_trades)
print(f'Unique WIF entry prices: {len(wif_entries)}')
print(f'Unique WIF exit prices: {len(wif_exits)}')
print(f'Entry price samples: {sorted(list(wif_entries))[:10]}')
print(f'Exit price samples: {sorted(list(wif_exits))[:10]}')

# Check the engine source to see how prices are generated
print('\n=== CRITICAL: Are prices from real DexScreener or randomly generated? ===')
print('Checking Rust scanner source...')
