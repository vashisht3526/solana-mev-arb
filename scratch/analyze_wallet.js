const https = require('https');

const wallet = 'MRiYA4oN3158fCV8evhuCofrDzbHyYvYnGZUDJvoCsa';

function rpcCall(method, params) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
        const req = https.request({
            hostname: 'api.mainnet-beta.solana.com',
            port: 443,
            path: '/',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }
        }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve(JSON.parse(d).result); } catch(e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function fetchTokenInfo(mint) {
    return new Promise((resolve) => {
        https.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(d);
                    const pair = json.pairs && json.pairs[0];
                    if (pair) {
                        resolve({
                            symbol: pair.baseToken?.symbol || 'UNKNOWN',
                            name: pair.baseToken?.name || 'UNKNOWN',
                            dex: pair.dexId,
                            priceUsd: pair.priceUsd,
                            liquidityUsd: pair.liquidity?.usd || 0,
                            mcapUsd: pair.marketCap || pair.fdv || 0,
                            volume5m: pair.volume?.m5 || 0,
                            pairAgeHours: (Date.now() - (pair.pairCreatedAt || Date.now())) / 3600000
                        });
                    } else {
                        resolve(null);
                    }
                } catch(e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    console.log('🔍 Querying live transaction history for $1.8M Wallet:', wallet);
    const sigs = await rpcCall('getSignaturesForAddress', [wallet, { limit: 25 }]);
    if (!sigs || sigs.length === 0) return console.log('No sigs found');

    console.log(`Analyzing ${sigs.length} latest on-chain transactions...\n`);

    const tokenMap = new Map();

    for (const s of sigs) {
        try {
            const tx = await rpcCall('getTransaction', [
                s.signature,
                { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
            ]);
            if (!tx || !tx.meta) continue;

            const time = new Date((tx.blockTime || 0) * 1000).toISOString().substring(11, 19);
            const err = tx.meta.err ? '❌ ATOMIC REVERT' : '✅ PROFIT FILLED';
            const feeSol = ((tx.meta.fee || 0) / 1e9).toFixed(5);

            const preTokens = tx.meta.preTokenBalances || [];
            const postTokens = tx.meta.postTokenBalances || [];
            const mints = [...new Set([...preTokens.map(t => t.mint), ...postTokens.map(t => t.mint)])]
                .filter(m => m !== 'So11111111111111111111111111111111111111112'); // Exclude WSOL

            const preBal = tx.meta.preBalances[0] / 1e9;
            const postBal = tx.meta.postBalances[0] / 1e9;
            const solDelta = (postBal - preBal).toFixed(5);

            console.log(`[${time} UTC] Sig: ${s.signature.substring(0, 16)}... | Status: ${err} | SOL Delta: ${solDelta >= 0 ? '+' : ''}${solDelta} SOL | Fee: ${feeSol} SOL`);

            for (const mint of mints) {
                if (!tokenMap.has(mint)) {
                    const info = await fetchTokenInfo(mint);
                    tokenMap.set(mint, info);
                }
                const meta = tokenMap.get(mint);
                if (meta) {
                    console.log(`   🪙 Token: ${meta.symbol} (${meta.name}) | DEX: ${meta.dex.toUpperCase()} | Liq: $${Math.round(meta.liquidityUsd).toLocaleString()} | MCAP: $${Math.round(meta.mcapUsd).toLocaleString()} | 5m Vol: $${Math.round(meta.volume5m).toLocaleString()}`);
                } else {
                    console.log(`   🪙 Mint: ${mint}`);
                }
            }
            console.log('--------------------------------------------------------------------------------');
        } catch(e) {
            console.error('Error:', e.message);
        }
    }
}

run();
