const https = require('https');

https.get('https://api.dexscreener.com/latest/dex/tokens/9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log('Total pairs for Fartcoin:', json.pairs ? json.pairs.length : 0);
        if (json.pairs) {
            json.pairs.forEach((p, i) => {
                console.log(`[Pair ${i}] DEX: ${p.dexId} | Pair: ${p.baseToken.symbol}/${p.quoteToken.symbol} | PriceUSD: ${p.priceUsd} | Liquidity: $${p.liquidity?.usd} | 24h Vol: $${p.volume?.h24} | Address: ${p.pairAddress}`);
            });
        }
    });
});
