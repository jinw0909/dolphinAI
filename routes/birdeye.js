var express = require('express');
var router = express.Router();
const moment = require('moment-timezone');
const axios = require('axios');
const { TopTrader, TxHistory, Tokens, TradedTokens, sequelize} = require('../models');
let tempUserAddress;
let tempUserNum;
let tempTxHistory;
const transactionCache = new Map();
function toProperNumber(value) {
    return Number(value);
}
// const getTransactionData = async function() {
//     try {
//         //// Step 1: Fetch rows from 'toptrader' where target = 'Y' and limit to 5 rows
//         // const [rows] = await db.query('SELECT * FROM toptrader WHERE target = ? LIMIT 5', ['Y']);
//         // if (!rows || rows.length === 0) {
//         //     console.log('No traders found with target = Y');
//         //     return [];
//         // }
//         const traders = await TopTrader.findAll({
//             where: { target: 'Y' },
//             limit: 5,
//         });
//
//         if (!traders || traders.length === 0) {
//             console.log('No traders found with target = Y');
//             return [];
//         }
//
//         const metadata = [];
//
//         // for (const row of rows) {
//         //     const { address } = row;
//         for (const trader of traders) {
//             const { address } = trader;
//             try {
//                 //Step 2. Fetch transaction history for the trader's address
//                 const transactionHistory = await fetchTransactionHistory(address, 7);
//                 // console.log("tx history: ", transactionHistory);
//
//                 //Step 3. Process transaction history to derive metadata
//                 const {metadata: stats} = await processTransactionsOnly(transactionHistory);
//                 //Prepare metadata for the current trader
//                 metadata.push({
//                     address,
//                     win_rate: stats.total_win_rate,
//                     total_buy_count: stats.total_buy_count,
//                     total_sell_count: stats.total_sell_count,
//                     token_count: stats.token_count,
//                     pnl_per_token: stats.pnl_per_token,
//                     total_pnl_percentage_overall: stats.total_pnl_percentage_overall,
//                 });
//
//                 //Step 4. Update the database with derived metadata
//                 // await db.query(
//                 //     'UPDATE toptrader SET winrate = ?, 7d_rate = ?, token_number = ? WHERE address = ?',
//                 //     [stats.total_win_rate, stats.total_pnl_percentage_overall, stats.token_count, address]
//                 // );
//                 // Step 4: Update the database with derived metadata
//                 await TopTrader.update(
//                     {
//                         winrate: stats.total_win_rate,
//                         '7d_rate': stats.total_pnl_percentage,
//                         '7d_pnl': stats.total_pnl,
//                         '7d_trade_count': stats.total_transactions,
//                         '7d_buy_count': stats.total_buy_count,
//                         '7d_sell_count': stats.total_sell_count,
//                         '7d_cost': stats.total_cost,
//                         '7d_token_count': stats.token_count,
//                         '7d_pnl_per_token': stats.pnl_per_token,
//                         'update_dt': moment.unix(transaction.block_unix_time).tz('Asia/Seoul').toDate()
//                     },
//                     {
//                         where: { address },
//                     }
//                 );
//
//                 console.log(`Updated trader metadata for address: ${address}`);
//
//             } catch (error) {
//                 console.error('Error fetching transaction data:', error);
//                 throw error;
//             }
//         }
//         return metadata;
//     } catch (error) {
//         console.error('Error fetching transaction data:', error);
//         throw error;
//     }
// }
const getTransactionData = async function () {
    try {
        await Tokens.update(
            { target: 'N'},
            { where: {}}
        );

        await TradedTokens.update(
            { current: 'N'},
            { where: {}}
        );

        const traders = await TopTrader.findAll({
            where: { target: 'Y' },
            // limit: 10,
            order: [['update_dt', 'DESC']]
        });

        if (!traders || traders.length === 0) {
            console.log('No traders found with target = Y');
            return [];
        }

        const metadata = [];

        for (const trader of traders) {
            const { address } = trader;

            try {
                // Retrieve processResult from the cache
                let processResult = transactionCache.get(address)?.processResult;

                if (!processResult) {
                    console.log(`No cached data for address: ${address}. Fetching and processing new data...`);

                    // Fetch new transaction history and process it
                    const txHistory = await fetchTransactionHistory(address, 7);
                    processResult = await processTransactionsOnly(txHistory, trader.id, address);

                    // Cache the fetched and processed data
                    transactionCache.set(address, { txHistory, processResult });
                } else {
                    console.log(`Using cached process result for address: ${address}`);
                }

                // Destructure the cached or newly processed data
                const { transactions, metadata: stats } = processResult;

                // Check if total_pnl is zero or negative
                if (stats.total_pnl <= 0) {
                    console.log(`Total PnL is non-positive for address: ${address}. Setting target = 'N' and skipping`);
                    await TopTrader.update(
                        { target: 'N'},
                        { where: {address}}
                    );
                    continue;
                }

                // Step 3: Save processed transactions into txHistory
                for (const tx of transactions) {
                    try {
                        const existingTx = await TxHistory.findOne({
                            where: { txhash: tx.txhash },
                        });
                        if (existingTx) {
                            console.log(`Transaction already exists: ${tx.txhash}`);
                            continue;
                        }
                        await TxHistory.create(tx);
                        console.log(`Inserted transaction: ${tx.txhash}`);
                    } catch (err) {
                        console.error(`Failed to insert transaction: ${tx.txhash}`, err.message);
                    }
                }

                // Step 4: Save traded tokens data into TradedTokens
                const tradedTokens = stats.traded_tokens;

                for (const [token, data] of Object.entries(tradedTokens)) {
                    try {
                        await TradedTokens.upsert({
                            user_num: trader.id, // Assuming this is the user address or identifier
                            symbol: token,
                            buy_count: data.buy_count || 0, // Fallback if data is missing
                            sell_count: data.sell_count || 0,
                            positive_sell_count: data.positive_sell_count || 0,
                            pnl: data.pnl || 0,
                            pnl_percentage: data.pnl_percentage || 0,
                            cost: data.cost || 0,
                            avg_price: data.avg_price || 0,
                            holding: data.holding || 0,
                            win_rate: data.win_rate || 0,
                            current: 'Y',
                            symbol_address: data.symbol_address || null, // Ensure this matches the condition
                            user_address: address || null
                        }, {
                            conflictFields: ['user_address', 'symbol_address'], // Fields to match on upsert
                        });
                        console.log(`Upserted traded token: ${token}`);
                    } catch (err) {
                        console.error(`Failed to upsert traded token: ${token}`, err.message);
                    }
                }

                // Step 4: Insert or update rows in Tokens table
                for (const [token, data] of Object.entries(tradedTokens)) {
                    try {
                        // Use upsert to insert or update the token
                        await Tokens.upsert({
                            address: data.symbol_address,
                            symbol: token, // Insert or update the token name
                            target: 'Y',   // Set target to 'Y'
                        });

                        console.log(`Upserted token: ${token}`);
                    } catch (err) {
                        console.error(`Failed to upsert token: ${token}`, err.message);
                    }
                }


                // Step 5: Update TopTrader table with derived metadata
                await TopTrader.update(
                    {
                        winrate: stats.total_win_rate,
                        '7d_rate': stats.total_pnl_percentage,
                        '7d_pnl': stats.total_pnl,
                        '7d_trade_count': stats.total_transactions,
                        '7d_buy_count': stats.total_buy_count,
                        '7d_sell_count': stats.total_sell_count,
                        '7d_cost': stats.total_cost,
                        '7d_token_count': stats.token_count,
                        '7d_pnl_per_token': stats.pnl_per_token,
                        '7d_cost_per_token': stats.cost_per_token,
                        'update_dt': moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'), // Use current timestamp
                    },
                    {
                        where: { address },
                    }
                );

                console.log(`Updated trader metadata for address: ${address}`);

                // Collect metadata for this trader
                metadata.push({
                    address,
                    win_rate: stats.total_win_rate,
                    total_buy_count: stats.total_buy_count,
                    total_sell_count: stats.total_sell_count,
                    token_count: stats.token_count,
                    pnl_per_token: stats.pnl_per_token,
                    cost_per_token: stats.cost_per_token,
                    total_pnl_percentage: stats.total_pnl_percentage,
                });
            } catch (error) {
                console.error(`Error processing transactions for address ${address}:`, error);
            }
        }
        return metadata;
    } catch (error) {
        console.error('Error fetching transaction data:', error);
        throw error;
    }
};
async function fetchTransactionHistory(address, days) {
    const startTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
    let transactions = [];
    let offset = 0;
    const limit = 100;

    try {
        while (true) {
            const options = {
                method: 'GET',
                url: 'https://public-api.birdeye.so/trader/txs/seek_by_time',
                params: {
                    address,
                    offset: offset.toString(),
                    limit: limit.toString(),
                    tx_type: 'swap',
                    sort_type: 'desc',
                    after_time: startTime.toString(),
                },
                headers: {
                    accept: 'application/json',
                    'x-chain': 'solana',
                    'X-API-KEY': process.env.X_API_KEY,
                },
            };

            const response = await axios.request(options);
            const data = response.data.data.items;

            if (!data || data.length === 0) break;

            transactions = transactions.concat(data);

            if (!response.data.data.has_next) break;

            offset += limit;
        }
        return transactions;
    } catch (error) {
        console.error(`Error fetching transaction history for address ${address}`, error);
        throw error;
    }
}
const updateTrader = async function(address) {
    try {
        // Fetch transaction history for the past 1 day
        const transactions = await fetchTransactionHistory(address, 1);
        // Initialize wallet state
        console.log("transaction history: ", transactions);
        const wallet = {};
        let totalPnl = 0;
        let totalBuyCost = 0;

        for (const transaction of transactions) {
            const base = transaction.base;
            const quote = transaction.quote;

            if (!base || !quote) continue;

            const token = base.symbol;
            const tradeType = base.type_swap === 'to' ? 'buy' : 'sell';
            const amount = base.ui_amount;
            const price = base.price ||
                (quote.nearest_price * quote.ui_amount / base.ui_amount) ||
                null;

            if (!price || !amount) continue;

            const tradeVolume = amount * price;

            if (tradeType === 'buy') {
                // Update wallet state for a buy
                if (!wallet[token]) {
                    wallet[token] = { averagePrice: 0, amount: 0 };
                }

                const current = wallet[token];
                current.averagePrice =
                    (current.averagePrice * current.amount + tradeVolume) /
                    (current.amount + amount);
                current.amount += amount;

                totalBuyCost += tradeVolume;
            } else if (tradeType === 'sell') {
                // Check if we have enough balance to sell
                if (!wallet[token] || wallet[token].amount < amount) {
                    console.error(`Insufficient amount to sell for token ${token}`);
                    continue;
                }

                const current = wallet[token];
                const pnl = amount * (price - current.averagePrice);
                totalPnl += pnl;

                current.amount -= amount;

                if (current.amount === 0) {
                    // Reset the wallet entry if all tokens are sold
                    current.averagePrice = 0;
                }
            }
        }

        const pnlRate = totalBuyCost > 0 ? (totalPnl / totalBuyCost) * 100 : 0;

        // Update the trader's PnL and rate (Assuming a Sequelize model `Trader` exists)
        await TopTrader.update(
            { '1d_pnl': totalPnl, '1d_rate': pnlRate },
            { where: { address } }
        );

        console.log(`Updated 1d_pnl and 1d_rate for trader ${address}`);
    } catch (error) {
        console.error(`Error updating trader ${address}`, error);
    }
};
// const processTransactionsOnly = async function (fetchedData, userId, userAddress) {
//     if (!fetchedData || fetchedData.length === 0) {
//         console.error("Fetched data is empty or invalid.");
//         return { transactions: [], metadata: {} };
//     }
//
//     const wallet = {};
//     const finalPnl = {};
//     let transactionData = [];
//     let totalBuyCost = {};
//     let overallBuyCost = 0;
//
//     let buyCount = 0;
//     let sellCount = 0;
//     let positiveSellCount = 0;
//     const tradedTokens = new Set();
//
//     fetchedData.forEach((transaction) => {
//         const base = transaction.base;
//         const quote = transaction.quote;
//
//         if (!base || !quote) return; // Skip invalid transactions
//         if (base.symbol === "SOL") return; // Skip SOL transactions
//
//         const token = base.symbol;
//         const tradeType = base.type_swap === 'to' ? 'buy' : 'sell';
//         const amount = base.ui_amount;
//
//         let price = base.price || (quote.nearest_price && quote.ui_amount && base.ui_amount
//             ? (quote.nearest_price * quote.ui_amount) / base.ui_amount
//             : null);
//
//         if (!price) {
//             console.error(`Unable to determine price for token ${token}`);
//             return;
//         }
//         price = toProperNumber(price);
//         const tradeVolume = amount * price;
//
//         tradedTokens.add(token);
//
//         if (tradeType === 'buy') {
//             buyCount++;
//             if (!wallet[token]) wallet[token] = { averagePrice: 0, amount: 0 };
//             const current = wallet[token];
//             current.amount += amount;
//             current.averagePrice = (current.averagePrice * (current.amount - amount) + amount * price) / current.amount;
//
//             totalBuyCost[token] = (totalBuyCost[token] || 0) + amount * price;
//             overallBuyCost += amount * price;
//
//         } else if (tradeType === 'sell') {
//             sellCount++;
//             if (!wallet[token] || wallet[token].amount < amount) {
//                 console.error(`Insufficient amount to sell for token ${token}`);
//                 return;
//             }
//             const current = wallet[token];
//             const pnl = amount * price - amount * current.averagePrice;
//
//             if (pnl > 0) positiveSellCount++;
//             current.amount -= amount;
//
//             if (!finalPnl[token]) finalPnl[token] = 0;
//             finalPnl[token] += pnl;
//         }
//
//         transactionData.push({
//             symbol: token,
//             trade_type: tradeType,
//             trade_volume: tradeVolume,
//             price,
//             amount,
//             time: transaction.block_unix_time,
//         });
//     });
//
//     const totalPnlPercentage = {};
//     let totalFinalPnl = 0;
//
//     Object.keys(finalPnl).forEach((token) => {
//         const tokenBuyCost = totalBuyCost[token] || 0;
//         if (tokenBuyCost > 0) {
//             totalPnlPercentage[token] = (finalPnl[token] / tokenBuyCost) * 100;
//         }
//         totalFinalPnl += finalPnl[token];
//     });
//
//     const winRate = sellCount > 0 ? (positiveSellCount / sellCount) * 100 : 0;
//     const overallPnlPercentage = overallBuyCost > 0 ? (totalFinalPnl / overallBuyCost) * 100 : 0;
//
//     const metadata = {
//         total_transactions: buyCount + sellCount,
//         total_buy_cost: overallBuyCost,
//         buy_cost_per_token: totalBuyCost,
//         total_pnl_percentage_per_token: totalPnlPercentage,
//         total_pnl_percentage_overall: overallPnlPercentage,
//         final_pnl_per_token: finalPnl,
//         pnl_per_token: totalFinalPnl / tradedTokens.size,
//         total_final_pnl: totalFinalPnl,
//         total_buy_count: buyCount,
//         total_sell_count: sellCount,
//         token_count: tradedTokens.size,
//         total_win_rate: winRate,
//     };
//
//     console.log("Metadata: ", metadata);
//     return { transactions: transactionData, metadata };
// };
const processTransactions = async function (fetchedData, userId, userAddress) {
    if (!fetchedData || fetchedData.length === 0) {
        console.error("Fetched data is empty or invalid.");
        return { transactions: [], metadata: {} };
    }

    const wallet = {};
    const finalPnl = {};
    let transactionData = [];
    let totalBuyCost = {};
    let overallBuyCost = 0;

    let buyCount = 0;
    let sellCount = 0;
    let positiveSellCount = 0;
    const tradedTokens = new Map();

    for (const transaction of fetchedData) {
        const base = transaction.base;
        const quote = transaction.quote;

        if (!base || !quote) continue; // Skip invalid transactions
        if (base.symbol === "SOL") continue; // Skip SOL transactions

        const token = base.symbol;
        const address = base.address;
        const tradeType = base.type_swap === 'to' ? 'buy' : 'sell';
        const amount = base.ui_amount;

        let price = base.price || (quote.nearest_price && quote.ui_amount && base.ui_amount
            ? (quote.nearest_price * quote.ui_amount) / base.ui_amount
            : null);

        if (!price) {
            console.error(`Unable to determine price for token ${token}`);
            continue;
        }
        price = toProperNumber(price);
        const tradeVolume = amount * price;
        // Add address and symbol to the Map
        if (!tradedTokens.has(address)) {
            tradedTokens.set(address, token); // Store only address-symbol pairs
        }
        let pnl = null;
        let pnlPercentage = null;
        let holdAmount = null;
        let avgPrice = null;

        if (tradeType === 'buy') {
            buyCount++;
            if (!wallet[token]) wallet[token] = { averagePrice: 0, amount: 0 };
            const current = wallet[token];
            current.amount += amount;
            current.averagePrice = (current.averagePrice * (current.amount - amount) + amount * price) / current.amount;

            totalBuyCost[token] = (totalBuyCost[token] || 0) + amount * price;
            overallBuyCost += amount * price;

            holdAmount = current.amount;
            avgPrice = current.averagePrice;

        } else if (tradeType === 'sell') {
            sellCount++;
            if (!wallet[token] || wallet[token].amount < amount) {
                console.error(`Insufficient amount to sell for token ${token}`);
                continue;
            }
            const current = wallet[token];
            pnl = amount * price - amount * current.averagePrice;
            pnlPercentage = (pnl / (amount * current.averagePrice)) * 100;

            if (pnl > 0) positiveSellCount++;
            current.amount -= amount;

            holdAmount = current.amount;
            avgPrice = current.averagePrice;

            if (!finalPnl[token]) finalPnl[token] = 0;
            finalPnl[token] += pnl;
        }

        const txEntry = {
            txhash: transaction.tx_hash,
            symbol: token,
            symbol_address: base.address,
            position: tradeType,
            time: transaction.block_unix_time,
            datetime: moment.unix(transaction.block_unix_time).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'), //KST
            cost: price,
            balance: amount,
            size: tradeVolume,
            pnl,
            pnl_percentage: pnlPercentage,
            user_num: userId,
            user_address: userAddress,
            hold_amount: holdAmount,
            avg_price: avgPrice,
        };

        transactionData.push(txEntry);

        // Insert transaction into tx_history table
        try {
            const existingTransaction = await TxHistory.findOne({ where: { txhash: transaction.tx_hash } });
            if (!existingTransaction) {
                await TxHistory.create(txEntry);
                console.log(`Inserted new transaction for ${token}: ${transaction.tx_hash}`);
            } else {
                console.log(`Transaction already exists for ${transaction.tx_hash}. Skipping.`);
            }
        } catch (err) {
            console.error(`Failed to process transaction for ${token}: ${err.message}`);
        }

    }



    // Process unique tokens after the iteration
    for (const [address, symbol] of tradedTokens.entries()) {

        const pnl = finalPnl[symbol] || 0;
        const pnlPercentage = totalPnlPercentage[symbol] || 0;
        const totalCost = totalBuyCost[symbol] || 0;
        const avgBuyCost = wallet[symbol] ? wallet[symbol].averagePrice : 0;

        // Calculate win rate for the token
        const tokenSellCount = fetchedData.filter(
            (transaction) => transaction.base.symbol === symbol && transaction.base.type_swap !== 'to'
        ).length;
        const tokenPositiveSellCount = fetchedData.filter(
            (transaction) =>
                transaction.base.symbol === symbol &&
                transaction.base.type_swap !== 'to' &&
                finalPnl[symbol] > 0
        ).length;
        const tokenWinRate = tokenSellCount > 0 ? (tokenPositiveSellCount / tokenSellCount) * 100 : 0;



        try {
            // Check if a row already exists for the same user_address and symbol_address
            const existingEntry = await TokenMetadata.findOne({
                where: {
                    user_address: userAddress,
                    symbol_address: address,
                },
            });

            if (existingEntry) {
                // Update the existing entry
                await existingEntry.update({
                    pnl,
                    pnl_percentage: pnlPercentage,
                    current: 'Y', // Mark as current for the current transaction
                    win_rate: tokenWinRate,
                    total_buy_cost: totalCost,
                    average_buy_cost: avgBuyCost,
                });
                console.log(`Updated metadata for token ${symbol}`);
            } else {
                // Insert new metadata
                await TokenMetadata.create({
                    user_address: userAddress,
                    symbol,
                    symbol_address: address,
                    icon: null, // Populate later if necessary
                    pnl,
                    pnl_percentage: pnlPercentage,
                    current: 'Y', // Mark as current for the current transaction
                    win_rate: tokenWinRate,
                    total_buy_cost: totalCost,
                    average_buy_cost: avgBuyCost,
                });
                console.log(`Inserted metadata for token ${symbol}`);
            }
        } catch (error) {
            console.error(`Failed to insert or update metadata for token ${symbol}: ${error.message}`);
        }

        try {
            const tokenExists = await Token.findOne({ where: { address } });
            if (!tokenExists) {
                await Token.create({
                    address,
                    name: symbol, // Insert address and name (symbol) only
                });
                console.log(`Inserted new token: ${symbol} with address: ${address}`);
            }
        } catch (err) {
            console.error(`Failed to insert token ${symbol}: ${err.message}`);
        }
    }

    const totalPnlPercentage = {};
    let totalFinalPnl = 0;

    Object.keys(finalPnl).forEach((token) => {
        const tokenBuyCost = totalBuyCost[token] || 0;
        if (tokenBuyCost > 0) {
            totalPnlPercentage[token] = (finalPnl[token] / tokenBuyCost) * 100;
        }
        totalFinalPnl += finalPnl[token];
    });

    const tokenCount = tradedTokens.size;
    const pnlPerToken = tokenCount > 0 ? totalFinalPnl / tokenCount : 0;

    const winRate = sellCount > 0 ? (positiveSellCount / sellCount) * 100 : 0;
    const overallPnlPercentage = overallBuyCost > 0 ? (totalFinalPnl / overallBuyCost) * 100 : 0;

    const metadata = {
        total_transactions: transactionData.length,
        total_buy_cost: overallBuyCost,
        buy_cost_per_token: totalBuyCost,
        total_pnl_percentage_per_token: totalPnlPercentage,
        total_pnl_percentage_overall: overallPnlPercentage,
        final_pnl_per_token: finalPnl,
        total_final_pnl: totalFinalPnl,
        pnl_per_token: pnlPerToken,
        total_buy_count: buyCount,
        total_sell_count: sellCount,
        token_count: tradedTokens.size,
        total_win_rate: winRate,
    };

    console.log("Metadata: ", metadata);
    return { transactions: transactionData, metadata };
};
const processTransactionsOnly = async function (fetchedData, userId, userAddress) {
    console.log('process only address: ', userAddress);
    if (!fetchedData || fetchedData.length === 0) {
        console.error("Fetched data is empty or invalid.");
        return { transactions: [], metadata: {} };
    }

    const wallet = {};
    const tradedTokens = new Map(); // Store token-specific metrics
    let transactionData = [];

    let buyCount = 0;
    let sellCount = 0;
    let totalPnl = 0; // Aggregate total PnL across all tokens
    let totalCost = 0; // Aggregate total purchase volume
    let positiveSellCount = 0; // Count of all positive sell trades

    for (const transaction of fetchedData) {
        const base = transaction.base;
        const quote = transaction.quote;

        if (!base || !quote) continue; // Skip invalid transactions
        if (base.symbol === "SOL") continue; // Skip SOL transactions

        const token = base.symbol;
        const address = base.address;
        const tradeType = base.type_swap === 'to' ? 'buy' : 'sell';
        const amount = base.ui_amount;

        let price = base.price || (quote.nearest_price && quote.ui_amount && base.ui_amount
            ? (quote.nearest_price * quote.ui_amount) / base.ui_amount
            : null);

        if (!price) {
            console.error(`Unable to determine price for token ${token}`);
            continue;
        }
        price = toProperNumber(price);
        const tradeVolume = amount * price;

        // Initialize the traded token entry if not present
        if (!tradedTokens.has(token)) {
            tradedTokens.set(token, {
                buy_count: 0,
                sell_count: 0,
                positive_sell_count: 0, // Track positive PnL sell trades
                pnl: 0,
                pnl_percentage: 0,
                cost: 0,
                avg_price: 0,
                symbol_address: address
            });
        }
        const tokenData = tradedTokens.get(token);

        if (tradeType === 'buy') {
            buyCount++;
            tokenData.buy_count++;
            tokenData.cost += tradeVolume;
            totalCost += tradeVolume; // Add to total cost across all tokens

            if (!wallet[token]) wallet[token] = { averagePrice: 0, amount: 0 };
            const current = wallet[token];
            current.amount += amount;
            current.averagePrice = (current.averagePrice * (current.amount - amount) + amount * price) / current.amount;

            tokenData.avg_price = current.averagePrice;
            tokenData.holding = current.amount;
        } else if (tradeType === 'sell') {
            if (!wallet[token] || wallet[token].amount < amount) {
                console.error(`Insufficient amount to sell for token ${token}`);
                continue;
            }
            sellCount++;
            tokenData.sell_count++;

            const current = wallet[token];
            const pnl = amount * (price - current.averagePrice);
            totalPnl += pnl; // Aggregate total PnL

            if (pnl > 0) {
                tokenData.positive_sell_count++;
                positiveSellCount++;
            }

            tokenData.pnl += pnl; // Aggregate PnL for the token
            current.amount -= amount;

            if (tokenData.cost > 0) {
                tokenData.pnl_percentage = (tokenData.pnl / tokenData.cost) * 100;
            }
            tokenData.holding = current.amount;
        }

        // Add the transaction data
        transactionData.push({
            txhash: transaction.tx_hash,
            symbol: token,
            symbol_address: base.address,
            position: tradeType,
            time: transaction.block_unix_time,
            datetime: moment.unix(transaction.block_unix_time).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'),
            cost: price,
            balance: amount,
            size: tradeVolume,
            pnl: tokenData.pnl,
            pnl_percentage: tokenData.pnl_percentage,
            user_num: userId,
            user_address: userAddress,
            hold_amount: wallet[token]?.amount || 0,
            avg_price: wallet[token]?.averagePrice || 0,
        });
    }

    // Calculate win rates for all tokens
    tradedTokens.forEach((tokenData) => {
        if (tokenData.sell_count > 0) {
            tokenData.win_rate = (tokenData.positive_sell_count / tokenData.sell_count) * 100;
        } else {
            tokenData.win_rate = 0;
        }
    });

    const tokenCount = tradedTokens.size; // Number of unique tokens traded
    const totalWinRate = sellCount > 0 ? (positiveSellCount / sellCount) * 100 : 0; // Win rate for all transactions
    const totalPnlPercentage = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0; // Total PnL percentage
    const pnlPerToken = tokenCount > 0 ? totalPnl / tokenCount : 0; // PnL per token
    const costPerToken = tokenCount > 0 ? totalCost / tokenCount : 0; // Cost per token

    // Convert tradedTokens map to an object for metadata
    const tradedTokensObject = Object.fromEntries(tradedTokens);

    // Generate metadata
    const metadata = {
        total_transactions: buyCount + sellCount,
        total_buy_count: buyCount,
        total_sell_count: sellCount,
        total_pnl: totalPnl,
        total_pnl_percentage: totalPnlPercentage,
        total_win_rate: totalWinRate,
        token_count: tokenCount,
        total_cost: totalCost,
        pnl_per_token: pnlPerToken,
        cost_per_token: costPerToken, //Include cost per token
        traded_tokens: tradedTokensObject, // Include token-specific metrics
    };

    console.log("Metadata: ", metadata);
    return { transactions: transactionData, metadata };
};

/* GET home page. */
router.get('/traders', async function(req, res, next) {

    const options = {
        method: 'GET',
        url: 'https://public-api.birdeye.so/trader/gainers-losers',
        params: { type: '1W', sort_by: 'PnL', sort_type: 'desc', offset: '0', limit: '10' },
        headers: { accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': process.env.X_API_KEY }
    }

    try {
        const allTraders = [];
        const limit = 10;
        let offset = 0;
        const repetitions = 10;

        for (let i = 0; i < repetitions; i++) {
            const options = {
                method: 'GET',
                url: 'https://public-api.birdeye.so/trader/gainers-losers',
                params: {
                    type: '1W',
                    sort_by: 'PnL',
                    sort_type: 'desc',
                    offset: offset.toString(),
                    limit: limit.toString()
                },
                headers: {
                    accept: 'application/json',
                    'x-chain': 'solana',
                    'X-API-KEY': process.env.X_API_KEY,
                }
            };

            console.log(`Fetching data with offset: ${offset}`);
            const result = await axios.request(options);
            const traders = result.data.data.items;

            if (!traders || traders.length === 0) {
                console.log(`No more data found at offset ${offset}`);
                break; // Exit the loop if no traders are found
            }

            allTraders.push(...traders);

            for (const trader of traders) {
                const { address, trade_count, pnl, volume } = trader;

                const target = trade_count >= 50 && trade_count <= 1000 ? 'Y' : 'N';

                try {
                    // Use upsert to insert or update the trader
                    await TopTrader.upsert({
                        address,
                        tradecount: trade_count,
                        '7d': pnl,
                        tokenvalue: volume,
                        target_range: target,
                        update_dt: moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'),
                    });
                    console.log(`Upserted trader with address: ${address}`);
                } catch (err) {
                    console.error(`Error processing trader ${address}: `, err);
                }
            }

            offset += limit; // Increment the offset by the limit
        }

        res.status(200).send(allTraders);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }

});
router.get('/tradersonly', async function(req, res, next) {

    const options = {
        method: 'GET',
        url: 'https://public-api.birdeye.so/trader/gainers-losers',
        params: { type: '1W', sort_by: 'PnL', sort_type: 'desc', offset: '0', limit: '10' },
        headers: { accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': process.env.X_API_KEY }
    }

    try {
        const allTraders = [];
        const limit = 10;
        let offset = 0;
        const repetitions = 10;

        for (let i = 0; i < repetitions; i++) {
            const options = {
                method: 'GET',
                url: 'https://public-api.birdeye.so/trader/gainers-losers',
                params: {
                    type: '1W',
                    sort_by: 'PnL',
                    sort_type: 'desc',
                    offset: offset.toString(),
                    limit: limit.toString()
                },
                headers: {
                    accept: 'application/json',
                    'x-chain': 'solana',
                    'X-API-KEY': process.env.X_API_KEY,
                }
            };

            console.log(`Fetching data with offset: ${offset}`);
            const result = await axios.request(options);
            const traders = result.data.data.items;

            if (!traders || traders.length === 0) {
                console.log(`No more data found at offset ${offset}`);
                break; // Exit the loop if no traders are found
            }

            allTraders.push(...traders);

            // for (const trader of traders) {
            //     const { address, trade_count, pnl, volume } = trader;
            //
            //     const target = trade_count >= 50 && trade_count <= 1000 ? 'Y' : 'N';
            //
            //     try {
            //         // Use upsert to insert or update the trader
            //         await TopTrader.upsert({
            //             address,
            //             tradecount: trade_count,
            //             '7d': pnl,
            //             tokenvalue: volume,
            //             target,
            //             insert_dt: moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'),
            //         });
            //         console.log(`Upserted trader with address: ${address}`);
            //     } catch (err) {
            //         console.error(`Error processing trader ${address}: `, err);
            //     }
            // }

            offset += limit; // Increment the offset by the limit
        }

        res.status(200).send(allTraders);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }
});
router.get('/processtraders', async function(req, res) {
   try {
       transactionCache.clear();
       //Step 1. Set all 'target' to 'N'
       await TopTrader.update({target: 'N', target_confirm: 'N'}, {where: {}});
       let targetCount = 0;
       while (targetCount < 30) {
           //Step 2: Fetch rows with 'target_range = 'Y' and 'target_skip = 'N'
           const rows = await TopTrader.findAll({
               where: {
                   target_range: 'Y',
                   target_skip: 'N',
                   target_confirm: 'N'
               },
               order: [['update_dt', 'DESC']]
           });

           if (rows.length === 0) {
               console.log('No more unconfirmed rows to process');
               break;
           }

           for (const row of rows) {
               //Step 3: Analyze the row
               console.log("row.address: ", row.address);
               let txHistory = await fetchTransactionHistory(row.address, 7);
               let processResult = await processTransactionsOnly(txHistory, row.id, row.address);
               const meetsRequirements = processResult.metadata.total_pnl > 0;

               if (meetsRequirements) {
                   //Save the 7-day transaction data in the cache
                   transactionCache.set(row.address, {
                       txHistory,
                       processResult
                   });
                   await TopTrader.update({target: 'Y', target_confirm: 'Y'}, {where: {id: row.id}});
                   targetCount++;
               } else {
                   await TopTrader.update({target_skip: 'Y', target_confirm: 'Y'}, {where: {id: row.id}});
               }

               if (targetCount >= 30) break;
           }
       }
       let msg =
           `Processing complete. Total 'target' Y rows: ${targetCount}. ${
               targetCount < 30
                   ? 'Could not reach 30 rows due to insufficient eligible rows.'
                   : ''
           }`
       console.log(msg);
       res.status(200).send(msg);
   } catch (error) {
       console.error('Error processing TopTrader rows:', error);
       res.status(400).send('Error processing TopTrader rows');
   }
   // finally {
   //     await sequelize.close();
   // }
});
router.get('/list', async function(req, res, next) {
    const options = {
        method: 'GET',
        url: 'https://public-api.birdeye.so/defi/tokenlist',
        params: {
            sort_by: 'v24hUSD',
            sort_type: 'desc',
            offset: '0',
            limit: '50',
            min_liquidity: '100'
        },
        headers: {accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': process.env.X_API_KEY}
    };

    try {
        const result = await axios.request(options);
        const data = result.data;
        res.status(200).send(data);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }

});
router.get('/portfolio/:address', async function(req, res) {
    const walletAddress = req.params.address;
    const options = {
        method: 'GET',
        url: 'https://public-api.birdeye.so/v1/wallet/token_list',
        params: {wallet: walletAddress},
        headers: {accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': process.env.X_API_KEY}
    };

    try {
        const result = await axios.request(options);
        const data = result.data;
        res.status(200).send(data);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }
});
router.get('/history/:address', async function (req, res) {
    const walletAddress = req.params.address;
    userAddress = walletAddress;
    const oneMonthAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60; // Unix timestamp for one month ago

    let transactions = [];
    let requestCount = 0;
    let offset = 0;
    const limit = 100;
    const delay = 100; // Delay in milliseconds (100ms = 10 requests per second)

    const fetchTransactions = async (offset) => {
        const options = {
            method: 'GET',
            url: 'https://public-api.birdeye.so/trader/txs/seek_by_time',
            params: {
                address: walletAddress,
                offset: offset.toString(),
                limit: limit.toString(),
                // tx_type: 'swap',
                tx_type: 'all',
                sort_type: 'desc',
                after_time: oneMonthAgo.toString(),
            },
            headers: {
                accept: 'application/json',
                'x-chain': 'solana',
                'X-API-KEY': process.env.X_API_KEY,
            },
        };

        const result = await axios.request(options);
        return result.data;
    };

    try {
        while (true) {

            const data = await fetchTransactions(offset);

            requestCount++;
            // Append fetched transactions to the main list
            transactions = transactions.concat(data);
            console.log(requestCount);

            // Stop iteration if fewer than the limit are returned
            if (data.length < limit) break;
            if (data.data.items.length === 0 && !data.data.has_next) break;

            // Increment the offset for the next batch
            offset += limit;

            // Add a delay to respect rate limits
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        data = transactions;

        res.status(200).send(transactions);
    } catch (error) {
        console.error('Error fetching result:', error);
        res.status(400).send(error);
    }
});
router.get('/txhistory/:address', async function(req, res) {
   const walletAddress = req.params.address;
   try {
       // Step 1: Fetch the user's record from the TopTraders table
       const userRecord = await TopTrader.findOne({
           where: { address: walletAddress },
       });

       if (!userRecord) {
           return res.status(404).send({ message: 'User not found in TopTraders table.' });
       }

       // Save the user address and user number globally
       tempUserAddress = userRecord.address;
       tempUserNum = userRecord.id;

       // Step 2: Fetch the transaction history for the wallet address
       const result = await fetchTransactionHistory(walletAddress, 7);
       tempTxHistory = result;
       res.status(200).send(result);
   } catch (error) {
       console.error('error fetching result', error);
       res.status(400).send(error);
   }

});
router.get('/txhistory1/:address', async function(req, res) {
   const walletAddress = req.params.address;
   try {
       // Step 1: Fetch the user's record from the TopTraders table
       const userRecord = await TopTrader.findOne({
           where: { address: walletAddress },
       });

       if (!userRecord) {
           return res.status(404).send({ message: 'User not found in TopTraders table.' });
       }

       // Save the user address and user number globally
       tempUserAddress = userRecord.address;
       tempUserNum = userRecord.id;

       // Step 2: Fetch the transaction history for the wallet address
       const result = await fetchTransactionHistory(walletAddress, 1);
       tempTxHistory = result;
       res.status(200).send(result);
   } catch (error) {
       console.error('error fetching result', error);
       res.status(400).send(error);
   }

});
router.get('/txhistory30/:address', async function(req, res) {
    const walletAddress = req.params.address;
    try {
        // Step 1: Fetch the user's record from the TopTraders table
        const userRecord = await TopTrader.findOne({
            where: { address: walletAddress },
        });

        if (!userRecord) {
            return res.status(404).send({ message: 'User not found in TopTraders table.' });
        }

        // Save the user address and user number globally
        tempUserAddress = userRecord.address;
        tempUserNum = userRecord.id;

        // Step 2: Fetch the transaction history for the wallet address
        const result = await fetchTransactionHistory(walletAddress, 30);
        tempTxHistory = result;
        res.status(200).send(result);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }
});
router.get('/balance/:address/:token', async function(req, res) {
    const walletAddress = req.params.address;
    const tokenAddress = req.params.token;
    const options = {
        method: 'GET',
        url: 'https://public-api.birdeye.so/v1/wallet/token_balance',
        params: {
            wallet: walletAddress,
            token_address: tokenAddress,
        },
        headers: {accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': process.env.X_API_KEY}
    };

    try {
        const result = await axios.request(options);
        const data = result.data;
        res.status(200).send(data);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }
});
router.get('/price/:address', async function(req ,res) {
    const tokenAddress = req.params.address;
    const options = {
        method: 'GET',
        url: 'https://public-api.birdeye.so/defi/price',
        params: {
            address: tokenAddress,
        },
        headers: {accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': process.env.X_API_KEY}
    };

    try {
        const result = await axios.request(options);
        const data = result.data;
        res.status(200).send(data);
   } catch (error) {
       console.error('error fetching result', error);
       res.status(400).send(error);
   }
});
router.get('/search', async function(req, res) {
    const options = {
        method: 'GET',
        url: 'https://public-api.birdeye.so/defi/v3/search',
        params: {
            chain: 'solana',
            target: 'all',
            sort_by: 'volume_24h_usd',
            sort_type: 'desc',
            offset: '0',
            limit: '20'
        },
        headers: {accept: 'application/json', 'X-API-KEY': process.env.X_API_KEY}
    }

    try {
        const result = await axios.request(options);
        const data = result.data;
        res.status(200).send(data);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }

});
router.get('/creationinfo/:token', async function(req, res) {
    const tokenAddress = req.params.token;
    console.log("token address: ", tokenAddress);
    const options = {
        method: 'GET',
        url: 'https://public-api.birdeye.so/defi/token_creation_info',
        params: {
            address: tokenAddress,
        },
        headers: {accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': process.env.X_API_KEY}
    }

    try {
        const result = await axios.request(options);
        const data = result.data;
        res.status(200).send(data);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }


});
router.get('/process', async function(req, res) {
   try {
       const result = await processTransactions(tempTxHistory, tempUserNum, tempUserAddress);
       res.status(200).json(result);
   } catch (error) {
       console.error("failed to process transaction history", error);
   }
});
router.get('/processonly', async function(req, res) {
    try {
        const txData = await processTransactionsOnly(tempTxHistory, tempUserNum, tempUserAddress);
        res.status(200).json(txData);
    } catch (error) {
        console.error("failed to process transaction history", error);
    }
});
router.get('/txdata', async function(req, res) {
    try {
        const result = await getTransactionData();
        res.status(200).json(result);
    } catch (error) {
        console.error("failed to process transaction history", error);
    }
})
router.get('/update/:address', async function(req,res) {
    const userAddress = req.params.address;
    try {
        const result = await updateTrader(userAddress);
        res.status(200).send(`updated 1d pnl info of ${userAddress}`);
    } catch (error) {
        console.error("failed to update user");
    }
});
router.get('/upnl', async function(req, res) {
        try {
            // Fetch all active traded tokens (current = 'Y')
            const tradedTokens = await TradedTokens.findAll({
                where: { current: 'Y' },
                include: [
                    {
                        model: Tokens,
                        attributes: ['price'], // Fetch the current price from Tokens
                    },
                ],
            });

            if (!tradedTokens || tradedTokens.length === 0) {
                console.log('No active traded tokens found');
                return;
            }

            // Map to store total UPnL for each user
            const userUpnlMap = {};

            // Process each traded token
            for (const token of tradedTokens) {
                const {
                    user_address,
                    symbol_address,
                    holding,
                    avg_price,
                    Token: { price: currentPrice },
                } = token;

                if (!currentPrice || !holding || !avg_price) {
                    console.log(`Skipping token ${symbol_address} for user ${user_address} due to missing data.`);
                    continue;
                }

                // Calculate UPnL for the token
                const upnl = (currentPrice * holding) - (avg_price * holding);

                // Update the UPnL in the TradedTokens table
                await TradedTokens.update(
                    { upnl },
                    { where: { user_address, symbol_address } }
                );

                console.log(`Updated UPnL for token ${symbol_address}: ${upnl}`);

                // Accumulate total UPnL for the user
                if (!userUpnlMap[user_address]) {
                    userUpnlMap[user_address] = 0;
                }
                userUpnlMap[user_address] += upnl;
            }

            // Update total UPnL in TopTraders table
            for (const [user_address, totalUpnl] of Object.entries(userUpnlMap)) {
                await TopTrader.update(
                    { '7d_upnl': totalUpnl },
                    { where: { address: user_address } }
                );

                console.log(`Updated total UPnL (${totalUpnl}) for user: ${user_address}`);
            }

            console.log('Unrealized profit calculation completed.');
            res.status(200).send('Unrealized profit calculation completed.');
        } catch (error) {
            console.error('Error calculating unrealized profit:', error);
            res.status(500).send('An error occurred while calculating unrealized profit');
        }
});
router.get('/extrapnl', async function(req, res) {
    try {
        const rows = await TopTrader.findAll({
            where: {
                target: 'Y',
            },
            order: [['update_dt', 'DESC']]
        });

        if (rows.length === 0) {
            console.log('No trader to process extra pnl');
            return;
        }

        for (const row of rows) {
            //Step 3: Analyze the row
            console.log("row.address: ", row.address);
            let txHistoryDay = await fetchTransactionHistory(row.address, 1);
            let processResultDay = await processTransactionsOnly(txHistoryDay, row.id, row.address);
            let dayPnl = processResultDay.metadata.total_pnl;
            let dayRate = processResultDay.metadata.total_pnl_percentage;

            let txHistoryMonth = await fetchTransactionHistory(row.address, 30);
            let processResultMonth = await processTransactionsOnly(txHistoryMonth, row.id, row.address);
            let monthPnl = processResultMonth.metadata.total_pnl;
            let monthRate = processResultMonth.metadata.total_pnl_percentage;

            await TopTrader.update({'1d_pnl': dayPnl, '1d_rate': dayRate, '30d_pnl': monthPnl, '30d_rate': monthRate}, {where: {id: row.id}});

        }

        res.status(200).send("successfully processed and updated day and month pnl info");
    } catch (error) {
        console.error('Error processing extra pnls:', error);
        res.status(400).send('Error processing extra pnls');
    }
});
module.exports = router;
