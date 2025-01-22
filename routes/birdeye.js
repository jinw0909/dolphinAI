const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const axios = require('axios');
const { TopTrader, TxHistory, Tokens, TradedTokens, UserWallet, sequelize} = require('../models');

let tempUserAddress;
let tempUserNum;
let tempTxHistory;

const transactionCache = new Map();

function toProperNumber(value) {
    return Number(value);
}
const getTraders = async function() {
    console.log("executing function getTraders");
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
        const repetitions = 15;

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

            //console.log(`Fetching data with offset: ${offset}`);
            const result = await axios.request(options);
            const traders = result.data.data.items;

            if (!traders || traders.length === 0) {
                console.log(`No more data found at offset ${offset}`);
                break; // Exit the loop if no traders are found
            }

            allTraders.push(...traders);
            offset += limit; // Increment the offset by the limit
        }

        allTraders.reverse();

        for (const trader of allTraders) {
            const { address, trade_count, pnl, volume } = trader;
            const target = trade_count >= 50 && trade_count <= 1000 ? 'Y' : 'N';
            console.log("current time: ", moment().utc().format('YYYY-MM-DD HH:mm:ss'));
            try {
                // Use upsert to insert or update the trader
                await TopTrader.upsert({
                    address,
                    tradecount: trade_count,
                    '7d': pnl,
                    tokenvalue: volume,
                    target_range: target,
                    // update_dt: moment().utc().format('YYYY-MM-DD HH:mm:ss'),
                }, {
                    conflictFields: ['address'], // Optional: only for PostgreSQL
                });
                console.log(`Upserted trader with address: ${address}`);
            } catch (err) {
                console.error(`Error processing trader ${address}: `, err);
            }
        }
        return allTraders;
    } catch (error) {
        console.error('error fetching result', error);
    }
}
const processTraders = async function() {
    console.log("executing processTraders");
    try {
        transactionCache.clear();
        //Step 1. Set all 'target' to 'N'
        await TopTrader.update({show: 'N', target_confirm: 'N'}, {where: {}});
        console.log("set show and confirm to N");
        let targetCount = 0;
        while (targetCount < 30) {
            //Step 2: Fetch rows with 'target_range = 'Y' and 'target_skip = 'N'
            const rows = await TopTrader.findAll({
                where: {
                    target_range: 'Y',
                    target_skip: 'N',
                    target_confirm: 'N'
                },
                order: [['insert_dt', 'DESC']]
            });

            if (rows.length === 0) {
                console.log('No more unconfirmed rows to process');
                break;
            }

            for (const row of rows) {
                //Step 3: Analyze the row
                // console.log("row.address: ", row.address);
                let txHistory = await fetchTransactionHistory(row.address, 7);
                let processResult = await processTransactionsOnly(txHistory, row.id, row.address);
                const meetsRequirements = processResult.metadata.total_pnl > 0;

                if (meetsRequirements) {
                    //Save the 7-day transaction data in the cache
                    transactionCache.set(row.address, {
                        txHistory,
                        processResult
                    });

                    await TopTrader.update({
                        show: 'Y',
                        target_confirm: 'Y',
                        update_dt: moment().utc().format('YYYY-MM-DD HH:mm:ss')
                    }, {where: {id: row.id}});
                    targetCount++;
                } else {
                    await TopTrader.update({target_skip: 'Y', target_confirm: 'Y'}, {where: {id: row.id}});
                }

                if (targetCount >= 30) break;
            }
        }
        return `Processing complete. Total 'show' Y rows: ${targetCount}. ${
            targetCount < 30
                ? 'Could not reach 30 rows due to insufficient eligible rows.'
                : ''
        }`;
    } catch (error) {
        console.error("Error while validating(processing) Traders and saving each tx cache");
    }
}

//main function
const processTransactionData = async function () {
    console.log("executing processTransactionData");
    try {
        // Reset all 'show' column in TxHistory to 'N' before processing
        await TxHistory.update(
            { show: 'N' },
            { where: {} }
        );
        console.log("Setting all 'show' column in TxHistory to 'N'.");

        await Tokens.update(
            { ref: 'N' },
            { where: {} }
        );

        console.log("Setting all 'ref' column in Tokens to 'N'.");

        await TradedTokens.update(
            { show: 'N' },
            { where: {} }
        );

        console.log("Setting all 'show' column in Traded Tokens to 'N'.");

        const traders = await TopTrader.findAll({
            where: { show: 'Y' },
            limit: 30,
            // limit: 5,
            order: [['insert_dt', 'DESC']]
        });

        if (!traders || traders.length === 0) {
            console.log('No traders found with show = Y');
            return [];
        }

        let metadata = [];
        for (const trader of traders) {
            const { address } = trader;
            console.log("extracting tx history of address: " + address);
            try {
                let processResult = transactionCache.get(address)?.processResult;

                if (!processResult) {
                    console.log(`No cached data for address: ${address}. Fetching and processing new data...`);
                    const txHistory = await fetchTransactionHistory(address, 7);
                    processResult = await processTransactionsOnly(txHistory, trader.id, address);
                    transactionCache.set(address, { txHistory, processResult });
                } else {
                    console.log(`Using cached process result for address: ${address}`);
                }

                const { transactions, metadata: stats } = processResult;

                if (stats.total_pnl <= 0) {
                    console.log(`Total PnL is non-positive for address: ${address}. Setting show = 'N' and skipping`);
                    await TopTrader.update(
                        { show: 'N' },
                        { where: { address } }
                    );
                    continue;
                }


                // Insert or update rows in TxHistory and set 'show' to 'Y'
                for (const tx of transactions) {
                    try {
                        // Add or override the 'show' field in the transaction object
                        const txData = { ...tx, show: 'Y' };

                        await TxHistory.upsert(txData, {
                            conflictFields: ['txhash'], // Specify the unique constraint field(s)
                        });

                        //console.log(`Upserted transaction: ${tx.txhash}`);
                    } catch (err) {
                        console.error(`Failed to upsert transaction: ${tx.txhash}`, err.message);
                    }
                }
                console.log("transaction history upsert completed");

                const tradedTokens = stats.traded_tokens;
                // for (const [token, data] of Object.entries(tradedTokens)) {
                //     try {
                //         // Check if a record with the same user_address and symbol_address exists
                //         const existingRecord = await TradedTokens.findOne({
                //             where: {
                //                 user_address: address,
                //                 symbol_address: token
                //             }
                //         });
                //
                //         if (existingRecord) {
                //             // Update the 'show' field to 'Y' if the record exists
                //             await existingRecord.update({ show: 'Y' });
                //             console.log(`Updated 'show' to 'Y' for user_address: ${address} and symbol_address: ${data.symbol_address}`);
                //         } else {
                //             // Insert the new record
                //             await TradedTokens.create({
                //                 user_num: trader.id,
                //                 symbol: data.symbol,
                //                 buy_count: data.buy_count || 0,
                //                 sell_count: data.sell_count || 0,
                //                 positive_sell_count: data.positive_sell_count || 0,
                //                 pnl: data.pnl || 0,
                //                 pnl_percentage: data.pnl_percentage || 0,
                //                 cost: data.cost || 0,
                //                 avg_price: data.avg_price || 0,
                //                 holding: data.holding || 0,
                //                 win_rate: data.win_rate || 0,
                //                 show: 'Y',
                //                 symbol_address: token || null,
                //                 user_address: address || null
                //             });
                //             console.log(`Inserted new traded token: ${token}`);
                //         }
                //     } catch (err) {
                //         console.error(`Failed to process traded token: ${token}`, err);
                //     }
                // }

                for (const [token, data] of Object.entries(tradedTokens)) {
                    try {
                        await TradedTokens.upsert({
                                user_num: trader.id,
                                symbol: data.symbol,
                                buy_count: data.buy_count || 0,
                                sell_count: data.sell_count || 0,
                                positive_sell_count: data.positive_sell_count || 0,
                                pnl: data.pnl || 0,
                                pnl_percentage: data.pnl_percentage || 0,
                                cost: data.cost || 0,
                                avg_price: data.avg_price || 0,
                                holding: data.holding || 0,
                                win_rate: data.win_rate || 0,
                                show: 'Y',
                                symbol_address: token || null,
                                user_address: address || null
                            },
                            {
                                conflictFields: ['user_address', 'symbol_address'], // Fields to identify conflicts
                            });

                        console.log(`Upserted traded token: ${token}`);
                    } catch (err) {
                        console.error(`Failed to upsert traded token: ${token}`, err);
                    }
                }

                console.log("TradedTokens upsert completed");



                console.log("TradedTokens upsert completed");

                for (const [token, data] of Object.entries(tradedTokens)) {
                    try {
                        await Tokens.upsert({
                            address: token,
                            symbol: data.symbol,
                            ref: 'Y',
                            insert_dt: moment().utc().format('YYYY-MM-DD HH:mm:ss')
                        });
                    } catch (err) {
                        console.error(`Failed to upsert token: ${token}`, err.message);
                    }
                }

                console.log("Tokens upsert completed");

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
                    },
                    {
                        where: { address },
                    }
                );

                console.log("updated toptrader info");

                metadata.push({
                    address,
                    win_rate: stats.total_win_rate,
                    total_buy_count: stats.total_buy_count,
                    total_sell_count: stats.total_sell_count,
                    token_count: stats.token_count,
                    '7d_pnl': stats.total_pnl,
                    '7d_pnl_percentage': stats.total_pnl_percentage,
                    '7d_cost': stats.total_cost,
                    pnl_per_token: stats.pnl_per_token,
                    cost_per_token: stats.cost_per_token,
                });
            } catch (error) {
                console.error(`Error processing transactions for address ${address}:`, error);
            }
        }

        console.log("completed processTransactionData");
        return metadata;
    } catch (error) {
        console.error('Error fetching transaction data:', error);
    }
};

const processUpnl = async function() {
    console.log("process upnl");
    try {
        // Fetch all active traded tokens (current = 'Y')
        const tradedTokens = await TradedTokens.findAll({
            where: { show: 'Y' },
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

            if (!holding) {
                console.log(`Skipping token ${symbol_address} for user ${user_address} has holding of ${holding}.`);
                continue;
            }
            if (!currentPrice) {
                console.log(`Skipping token ${symbol_address} for user ${user_address}. Cannot load the price of token: ${currentPrice}`);
                continue;
            }
            if (!avg_price) {
                console.log(`Skipping token ${symbol_address} for user ${user_address}. avg_price is not provided: ${avg_price}`);
                continue;
            }

            // Calculate UPnL for the token
            const upnl = (currentPrice * holding) - (avg_price * holding);

            // Update the UPnL in the TradedTokens table
            await TradedTokens.update(
                { upnl },
                { where: { user_address, symbol_address } }
            );

            // console.log(`Updated UPnL for token ${symbol_address}: ${upnl}`);

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
            //console.log(`Updated total UPnL (${totalUpnl}) for user: ${user_address}`);
        }

        // // Step 2: Fetch Solana price
        // const solanaToken = await Tokens.findOne({
        //     where: { address: 'So11111111111111111111111111111111111111112' },
        //     attributes: ['price'],
        // });
        //
        // if (!solanaToken || !solanaToken.price) {
        //     console.error('Failed to fetch Solana price.');
        //     return;
        // }
        //
        // const solanaPrice = solanaToken.price;
        // const topTraders = await TopTrader.findAll({
        //     where: { show: 'Y' },
        //     attributes: ['address', 'sol_amount'],
        // });

        return "Unrealized profit calculation completed.";
    } catch (error) {
        console.log("error calculating unrealized profit");
        // throw error;
    }
}
const getExtraPnl = async function() {
    try {
        const rows = await TopTrader.findAll({
            where: {
                show: 'Y',
                '30d_pnl': null
            },
            order: [['insert_dt', 'DESC']]
        });

        if (rows.length === 0) {
            console.log('No trader to process extra pnl');
            return;
        }

        for (const row of rows) {
            //Step 3: Analyze the row
            //console.log("row.address: ", row.address);
            let txHistoryDay = await fetchTransactionHistory(row.address, 1);
            let processResultDay = await processTransactionsOnly(txHistoryDay, row.id, row.address);
            let dayPnl = processResultDay.metadata.total_pnl;
            let dayRate = processResultDay.metadata.total_pnl_percentage;

            let txHistoryMonth = await fetchTransactionHistory(row.address, 30);
            let processResultMonth = await processTransactionsOnly(txHistoryMonth, row.id, row.address);
            let monthPnl = processResultMonth.metadata.total_pnl;
            let monthRate = processResultMonth.metadata.total_pnl_percentage;
            let monthBuyCount = processResultMonth.metadata.total_buy_count;
            let monthSellCount = processResultMonth.metadata.total_sell_count;
            let monthTradeCount = processResultMonth.metadata.total_transactions;

            await TopTrader.update({
                '1d_pnl': dayPnl,
                '1d_rate': dayRate,
                '30d_pnl': monthPnl,
                '30d_rate': monthRate,
                '30d_buy_count': monthBuyCount,
                '30d_sell_count': monthSellCount,
                '30d_trade_count': monthTradeCount,
            }, {
                where: {id: row.id}
            });
        }

        return "successfully processed and updated day and month pnl info of TopTraders.";
    } catch (error) {
        console.error("error processing day and month pnl info of TopTraders", error);
        // throw error;
    }


}
const getSolanaPrice = async function() {
    try {
        const rows = await TopTrader.findAll({
            where: {
                show: 'Y',
            },
            order: [['insert_dt', 'DESC']]
        });

        if (rows.length === 0) {
            console.log('No trader to process extra pnl');
            return;
        }

        for (const row of rows) {
            const options = {
                method: 'GET',
                url: 'https://public-api.birdeye.so/v1/wallet/token_list',
                params: { wallet: row.address }, // Use the trader's wallet address
                headers: {
                    accept: 'application/json',
                    'x-chain': 'solana',
                    'X-API-KEY': process.env.X_API_KEY,
                },
            };

            let totalSolAmount = 0;
            let totalSolBalance = 0;

            try {
                const response = await axios.request(options);
                const tokenList = response.data.data.items;

                // Define the target addresses
                const solAddresses = [
                    'So11111111111111111111111111111111111111111',
                    'So11111111111111111111111111111111111111112'
                ];

                // Loop through the target addresses and sum their values
                solAddresses.forEach(address => {
                    const token = tokenList.find(token => token.address === address);
                    if (token) {
                        totalSolAmount += token.uiAmount || 0; // Accumulate user-friendly amounts
                        totalSolBalance += (token.uiAmount || 0) * (token.priceUsd || 0); // Accumulate total balances in USD
                    }
                });

                console.log(`SOL Amount: ${totalSolAmount}`);
                console.log(`SOL Balance (USD): ${totalSolBalance}`);

                await TopTrader.update({
                    'sol_amount': totalSolAmount,
                    'sol_balance': totalSolBalance
                }, {
                    where: {id: row.id}
                });
            } catch (apiError) {
                console.error(`Failed to fetch Solana data for trader ${row.address}:`, apiError.message);
            }


        }
    } catch (err) {
        console.error("error while fetching solana price");
    }
}
// const setTarget = async function() {
//
//     //Reset 'target to 'N' for all rows in both tables
//     await TopTrader.update({ target: 'N'}, { where: {} });
//     await TradedTokens.update({ current: 'N'}, { where: {} });
//     await Tokens.update({target: 'N'}, {where: {}});
//     await TxHistory.update({ current: 'N'}, {where: {}});
//     await UserWallet.update({current: 'N'}, {where: {}});
//
//     //Bulk update 'show' to 'Y' for TopTrader where 'target' is 'Y'
//     await TopTrader.update(
//         { target: 'Y' },
//         { where: { show: 'Y' }}
//     );
//
//     //Bulk update 'current' to 'Y' for TradedTokens where 'show' is 'Y'
//     await TradedTokens.update(
//         { current: 'Y' },
//         { where: { show: 'Y' }}
//     );
//
//     await Tokens.update(
//         { target: 'Y'},
//         { where: { ref: 'Y'}}
//     );
//
//     await TxHistory.update(
//         { current: 'Y'},
//         { where: { show: 'Y'}}
//     );
//
//     await UserWallet.update(
//         { current: 'Y'},
//         { where: { show: 'Y'}}
//     );
// }
const getExtraPnlDay = async function() {
    try {
        const rows = await TopTrader.findAll({
            where: {
                show: 'Y',
            },
            order: [['insert_dt', 'DESC']]
        });

        if (rows.length === 0) {
            console.log('No trader to process extra pnl');
            return;
        }

        for (const row of rows) {
            //Step 3: Analyze the row
            //console.log("row.address: ", row.address);
            let txHistoryDay = await fetchTransactionHistory(row.address, 1);
            let processResultDay = await processTransactionsOnly(txHistoryDay, row.id, row.address);
            let dayPnl = processResultDay.metadata.total_pnl;
            let dayRate = processResultDay.metadata.total_pnl_percentage;

            let txHistoryMonth = await fetchTransactionHistory(row.address, 30);
            let processResultMonth = await processTransactionsOnly(txHistoryMonth, row.id, row.address);
            let monthPnl = processResultMonth.metadata.total_pnl;
            let monthRate = processResultMonth.metadata.total_pnl_percentage;
            let monthBuyCount = processResultMonth.metadata.total_buy_count;
            let monthSellCount = processResultMonth.metadata.total_sell_count;
            let monthTradeCount = processResultMonth.metadata.total_transactions;

            await TopTrader.update({
                '1d_pnl': dayPnl,
                '1d_rate': dayRate,
                '30d_pnl': monthPnl,
                '30d_rate': monthRate,
                '30d_buy_count': monthBuyCount,
                '30d_sell_count': monthSellCount,
                '30d_trade_count': monthTradeCount,
            }, {
                where: {id: row.id}
            });
        }

        return "successfully processed and updated day and month pnl info of TopTraders.";
    } catch (error) {
        console.error("error processing day and month pnl info of TopTraders", error);
        // throw error;
    }


}
// const getTotalPnl = async function() {
//     try {
//         const rows = await TopTrader.findAll({
//             where: {
//                 target: 'Y',
//             },
//             order: [['update_dt', 'DESC']]
//         });
//
//         if (rows.length === 0) {
//             console.log('No trader to process extra pnl');
//             return;
//         }
//
//         // Step 2: Launch Puppeteer
//         const browser = await puppeteer.launch({
//             headless: true, // Use headless mode for efficiency
//             args: ['--no-sandbox', '--disable-setuid-sandbox'], // Needed for some environments like AWS EC2
//         });
//
//         const page = await browser.newPage();
//
//         for (const row of rows) {
//             try {
//                 // Step 3: Construct the URL
//                 const url = `https://gmgn.ai/sol/address/${row.address}`;
//                 console.log(`Fetching data for: ${url}`);
//
//                 // Step 4: Navigate to the URL
//                 await page.goto(url, { waitUntil: 'networkidle2' });
//
//                 // Step 5: Extract data from the page
//                 const data = await page.evaluate(() => {
//                     const div = document.querySelector('.css-1pjn4fe');
//                     if (!div) return null; // Handle cases where the div is not found
//                     return div.textContent.trim();
//                 });
//
//                 if (!data) {
//                     console.log(`No data found for address: ${row.address}`);
//                     continue;
//                 }
//
//                 // Step 6: Parse the extracted data
//                 const match = data.match(/^\+?\$([\d,.MK]+) \(\+?([\d.]+)%\)$/);
//                 if (!match) {
//                     console.log(`Invalid data format for address: ${row.address}, data: ${data}`);
//                     continue;
//                 }
//
//                 const totalPnl = match[1]; // Extract totalPnl value (e.g., "$1.4M")
//                 const totalPnlRate = parseFloat(match[2]); // Extract totalPnlRate as a number (e.g., 30.42)
//
//                 console.log(`Extracted for ${row.address} - totalPnl: ${totalPnl}, totalPnlRate: ${totalPnlRate}`);
//
//                 // Step 7: Update the database
//                 await TopTrader.update(
//                     { total_pnl: totalPnl, total_pnl_rate: totalPnlRate },
//                     { where: { id: row.id } }
//                 );
//                 console.log(`Updated database for address: ${row.address}`);
//             } catch (rowError) {
//                 console.error(`Error processing row for address: ${row.address}`, rowError.message);
//             }
//         }
//
//         // Step 8: Close Puppeteer
//         await browser.close();
//         console.log('Processing completed');
//
//     } catch (error) {
//         throw error;
//     }
// }

// const processTransactionsOnly = async function (fetchedData, userId, userAddress) {
//     console.log('process only address: ', userAddress);
//     if (!fetchedData || fetchedData.length === 0) {
//         console.error("Fetched data is empty or invalid.");
//         return { transactions: [], metadata: {} };
//     }
//
//     const wallet = {};
//     const tradedTokens = new Map(); // Store token-specific metrics
//     let transactionData = [];
//     //let solAmount = 0; //Track the total amount of solana used or received
//     let buyCount = 0;
//     let sellCount = 0;
//     let totalPnl = 0; // Aggregate total PnL across all tokens
//     let totalCost = 0; // Aggregate total purchase volume
//     let positiveSellCount = 0; // Count of all positive sell trades
//
//     for (const transaction of fetchedData) {
//         const base = transaction.base;
//         const quote = transaction.quote;
//
//         if (!base || !quote) continue; // Skip invalid transactions
//         //if (base.symbol === "SOL") continue; // Skip SOL transactions
//
//         // const token = base.symbol;
//         // const address = base.address;
//
//         let token;
//         let address;
//         let tradeType;
//         let amount, price, tradeVolume;
//
//         if (quote.symbol === 'SOL' && quote.type_swap === 'to') {
//             // Buy trade: Buying SPC with SOL
//             tradeType = 'sell';
//             amount = base.ui_amount; // SPC amount
//             price = toProperNumber(base.price) || (quote.ui_amount * quote.nearest_price / base.ui_amount);
//             tradeVolume = amount * price; // Total trade volume in USD
//             token = base.symbol;
//             address = base.address;
//             //solAmount += quote.ui_amount;
//         } else if (quote.symbol === 'SOL' && quote.type_swap === 'from') {
//             // Sell trade: Selling SPC for SOL
//             tradeType = 'buy';
//             amount = base.ui_amount; // SPC amount
//             price = toProperNumber(base.price) || (quote.ui_amount * quote.nearest_price / base.ui_amount);
//             tradeVolume = amount * price; // Total trade volume in USD
//             token = base.symbol;
//             address = base.address;
//             //solAmount -= quote.ui_amount;
//         } else if (base.symbol === 'SOL' && base.type_swap === 'from') {
//             // Buy trade: Buying SPC with SOL
//             tradeType = 'buy';
//             amount = quote.ui_amount; // SPC amount
//             price = toProperNumber(quote.price) || (base.ui_amount * base.nearest_price / quote.ui_amount); // SPC price in USD
//             tradeVolume = amount * price; // Total trade volume in USD
//             token = quote.symbol;
//             address = quote.address;
//             //solAmount -= base.ui_amount;
//         } else if (base.symbol === 'SOL' && base.type_swap === 'to') {
//             // Sell trade: Selling SPC for SOL
//             tradeType = 'sell';
//             amount = quote.ui_amount; // SPC amount
//             price = toProperNumber(quote.price) || (base.ui_amount * base.nearest_price / quote.ui_amount); // SPC price in USD
//             tradeVolume = amount * price; // Total trade volume in USD
//             token = quote.symbol;
//             address = quote.address;
//             //solAmount += base.ui_amount;
//         } else {
//             console.error(`Unsupported transaction type: ${JSON.stringify(transaction)}`);
//             continue; // Skip unsupported transactions
//         }
//
//         if (!price) {
//             console.error(`Invalid price for transaction: ${transaction.tx_hash}`);
//             continue;
//         }
//
//         if (tradeType === 'buy') {
//             // Initialize the traded token entry only on a buy trade
//             if (!tradedTokens.has(token)) {
//                 tradedTokens.set(token, {
//                     buy_count: 0,
//                     sell_count: 0,
//                     positive_sell_count: 0, // Track positive PnL sell trades
//                     pnl: 0,
//                     pnl_percentage: 0,
//                     cost: 0,
//                     avg_price: 0,
//                     symbol_address: address
//                 });
//             }
//             buyCount++;
//
//             const tokenData = tradedTokens.get(token);
//             tokenData.buy_count++;
//             tokenData.cost += tradeVolume;
//             totalCost += tradeVolume; // Add to total cost across all tokens
//
//             if (!wallet[token]) wallet[token] = { averagePrice: 0, amount: 0 };
//             const current = wallet[token];
//             current.amount += amount;
//             current.averagePrice = (current.averagePrice * (current.amount - amount) + amount * price) / current.amount;
//
//             tokenData.avg_price = current.averagePrice;
//             tokenData.holding = current.amount;
//
//         } else if (tradeType === 'sell') {
//             // Skip sell trades if the token has no buy history
//             if (!tradedTokens.has(token)) {
//                 console.warn(`Skipping sell trade for token ${token} as no prior buy trade exists.`);
//                 continue;
//             }
//
//             const tokenData = tradedTokens.get(token);
//             if (!wallet[token] || wallet[token].amount < amount) {
//                 console.error(`Insufficient amount to sell for token ${token}`);
//                 continue;
//             }
//
//             sellCount++;
//             tokenData.sell_count++;
//
//             const current = wallet[token];
//             const pnl = amount * (price - current.averagePrice);
//             totalPnl += pnl; // Aggregate total PnL
//
//             if (pnl > 0) {
//                 tokenData.positive_sell_count++;
//                 positiveSellCount++;
//             }
//
//             tokenData.pnl += pnl; // Aggregate PnL for the token
//             current.amount -= amount;
//
//             if (tokenData.cost > 0) {
//                 tokenData.pnl_percentage = (tokenData.pnl / tokenData.cost) * 100;
//             }
//             tokenData.holding = current.amount;
//         }
//
//         const tokenData = tradedTokens.get(token);
//         if (tokenData) {
//             transactionData.push({
//                 txhash: transaction.tx_hash,
//                 symbol: token,
//                 symbol_address: tokenData.symbol_address,
//                 position: tradeType,
//                 time: transaction.block_unix_time,
//                 datetime: moment.unix(transaction.block_unix_time).utc().format('YYYY-MM-DD HH:mm:ss'),
//                 cost: price,
//                 balance: amount,
//                 size: tradeVolume,
//                 pnl: tokenData.pnl,
//                 pnl_percentage: tokenData.pnl_percentage,
//                 user_num: userId,
//                 user_address: userAddress,
//                 hold_amount: wallet[token]?.amount || 0,
//                 avg_price: wallet[token]?.averagePrice || 0,
//             });
//         }
//     }
//
//     // Calculate win rates for all tokens
//     tradedTokens.forEach((tokenData) => {
//         if (tokenData.sell_count > 0) {
//             tokenData.win_rate = (tokenData.positive_sell_count / tokenData.sell_count) * 100;
//         } else {
//             tokenData.win_rate = 0;
//         }
//     });
//
//     const tokenCount = tradedTokens.size; // Number of unique tokens traded
//     const totalWinRate = sellCount > 0 ? (positiveSellCount / sellCount) * 100 : 0; // Win rate for all transactions
//     const totalPnlPercentage = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0; // Total PnL percentage
//     const pnlPerToken = tokenCount > 0 ? totalPnl / tokenCount : 0; // PnL per token
//     const costPerToken = tokenCount > 0 ? totalCost / tokenCount : 0; // Cost per token
//
//     // Convert tradedTokens map to an object for metadata
//     const tradedTokensObject = Object.fromEntries(tradedTokens);
//
//     // Generate metadata
//     const metadata = {
//         total_transactions: buyCount + sellCount,
//         total_buy_count: buyCount,
//         total_sell_count: sellCount,
//         total_pnl: totalPnl,
//         total_pnl_percentage: totalPnlPercentage,
//         total_win_rate: totalWinRate,
//         token_count: tokenCount,
//         total_cost: totalCost,
//         pnl_per_token: pnlPerToken,
//         cost_per_token: costPerToken, //Include cost per token
//         //sol_amount: solAmount,
//         traded_tokens: tradedTokensObject, // Include token-specific metrics
//     };
//
//     //console.log("Metadata: ", metadata);
//     return { transactions: transactionData, metadata };
// };
const processTransactionsOnly = async function (fetchedData, userId, userAddress) {
    console.log('Processing only address: ', userAddress);
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

    // Stablecoin addresses
    const stablecoinAddresses = [
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT (example, replace if incorrect)
        "So11111111111111111111111111111111111111112", // SOL
    ];

    for (const transaction of fetchedData) {
        const base = transaction.base;
        const quote = transaction.quote;

        if (!base || !quote) continue; // Skip invalid transactions

        // Skip stablecoin exchanges (USDC <-> USDT, USDC <-> SOL, etc.)
        if (
            stablecoinAddresses.includes(base.address) &&
            stablecoinAddresses.includes(quote.address)
        ) {
            console.warn(`Skipping stablecoin exchange transaction: ${transaction.tx_hash}`);
            continue;
        }

        let token;
        let address;
        let tradeType;
        let amount, price, tradeVolume;

        if (stablecoinAddresses.includes(quote.address)) {
            // Valid SPC trade with stablecoin as the quote currency
            tradeType = quote.type_swap === 'to' ? 'sell' : 'buy';
            amount = base.ui_amount; // SPC amount
            price = base.price || (quote.ui_amount * quote.nearest_price / base.ui_amount);
            tradeVolume = amount * price; // Total trade volume in USD
            token = base.symbol;
            address = base.address;
        } else if (stablecoinAddresses.includes(base.address)) {
            // Valid SPC trade with stablecoin as the base currency
            tradeType = base.type_swap === 'from' ? 'buy' : 'sell';
            amount = quote.ui_amount; // SPC amount
            price = quote.price || (base.ui_amount * base.nearest_price / quote.ui_amount);
            tradeVolume = amount * price; // Total trade volume in USD
            token = quote.symbol;
            address = quote.address;
        } else {
            console.error(`Unsupported transaction type: ${JSON.stringify(transaction)}`);
            continue;
        }

        if (!price) {
            console.error(`Invalid price for transaction: ${transaction.tx_hash}`);
            continue;
        }

        if (tradeType === 'buy') {
            // Initialize the traded token entry only on a buy trade
            if (!tradedTokens.has(address)) {
                tradedTokens.set(address, {
                    buy_count: 0,
                    sell_count: 0,
                    positive_sell_count: 0,
                    pnl: 0,
                    pnl_percentage: 0,
                    cost: 0,
                    avg_price: 0,
                    symbol_address: address,
                    symbol: token
                });
            }
            buyCount++;

            const tokenData = tradedTokens.get(address);
            tokenData.buy_count++;
            tokenData.cost += tradeVolume;
            totalCost += tradeVolume;

            if (!wallet[address]) wallet[address] = { averagePrice: 0, amount: 0 };
            const current = wallet[address];
            current.amount += amount;
            current.averagePrice =
                (current.averagePrice * (current.amount - amount) + amount * price) / current.amount;

            tokenData.avg_price = current.averagePrice;
            tokenData.holding = current.amount;
        } else if (tradeType === 'sell') {
            if (!tradedTokens.has(address)) {
                console.warn(`Skipping sell trade for token ${address} as no prior buy trade exists.`);
                continue;
            }

            const tokenData = tradedTokens.get(address);
            if (!wallet[address] || wallet[address].amount < amount) {
                console.error(`Insufficient amount to sell for token ${address}`);
                continue;
            }

            sellCount++;
            tokenData.sell_count++;

            const current = wallet[address];
            const pnl = amount * (price - current.averagePrice);
            totalPnl += pnl;

            if (pnl > 0) {
                tokenData.positive_sell_count++;
                positiveSellCount++;
            }

            tokenData.pnl += pnl;
            current.amount -= amount;

            if (tokenData.cost > 0) {
                tokenData.pnl_percentage = (tokenData.pnl / tokenData.cost) * 100;
            }
            tokenData.holding = current.amount;
        }

        transactionData.push({
            txhash: transaction.tx_hash,
            symbol: token,
            symbol_address: address,
            position: tradeType,
            time: transaction.block_unix_time,
            datetime: moment.unix(transaction.block_unix_time).utc().format('YYYY-MM-DD HH:mm:ss'),
            cost: price,
            balance: amount,
            size: tradeVolume,
            pnl: tradedTokens.get(address)?.pnl || 0,
            pnl_percentage: tradedTokens.get(address)?.pnl_percentage || 0,
            user_num: userId,
            user_address: userAddress,
            hold_amount: wallet[address]?.amount || 0,
            avg_price: wallet[address]?.averagePrice || 0,
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
        cost_per_token: costPerToken,
        traded_tokens: Object.fromEntries(tradedTokens), // Convert Map to Object
    };

    return { transactions: transactionData, metadata };
};

async function fetchTransactionHistory(address, days) {
    console.log("fetching transaction history of " + address);
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
        // throw error;
    }
}

/* GET home page. */
router.get('/traders', async function(req, res, next) {
    try {
        const result = await getTraders();
        res.status(200).send(result);
    } catch (error) {
        console.error('Error while fetching top traders list', error);
        res.status(500).send('Error while fetching top traders list', error);
    }
});
router.get('/processtraders', async function(req, res) {
   try {
       let result = await processTraders();
       res.status(200).send(result);
   } catch (error) {
       console.error('Error processing TopTrader rows:', error);
       res.status(500).send('Error processing TopTraders');
   }
});
router.get('/txdata', async function(req, res) {
    try {
        const result = await processTransactionData();
        res.status(200).json(result);
    } catch (error) {
        console.error("failed to process transaction history of TopTraders", error);
        res.status(500).send("failed to process transaction history of TopTraders");
    }
})
router.get('/upnl', async function(req, res) {
        try {
            const result = await processUpnl();
            res.status(200).send(result);
        } catch (error) {
            console.error('Error calculating unrealized profit:', error);
            res.status(500).send('An error occurred while calculating unrealized profit');
        }
});
router.get('/extrapnl', async function(req, res) {
    try {
        const result = await getExtraPnl();
        res.status(200).send(result);
    } catch (error) {
        console.error('Error processing extra pnls:', error);
        res.status(500).send('Error processing extra pnls');
    }
});
router.get('/extrapnlday', async function(req, res) {
    try {
        const result = await getExtraPnlDay();
        res.status(200).send(result);
    } catch (error) {
        console.error('Error processing extra pnls:', error);
        res.status(500).send('Error processing extra pnls');
    }
});
router.get('/solana', async function(req, res) {
    try {
        const result = await getSolanaPrice();
        res.status(200).send("setting solana price complete");
    } catch (error) {
        console.error('Error fetching solana price:', error);
        res.status(500).send('Error fetching solana price');
    }
});
// router.get('/settarget', async function(req, res) {
//     try {
//         const result = await setTarget();
//         res.status(200).send("setting target complete");
//     } catch (error) {
//         console.error('Error setting target rows:', error);
//         res.status(500).send('Error setting target rows');
//     }
// });

//extra endpoints
router.get('/traders/:number', async function(req, res) {
    const number = req.params.number;
    try {
        const allTraders = [];
        const limit = 10;
        let offset = 10;
        for (let i = 0; i < number; i++) {
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
            offset += limit; // Increment the offset by the limit
        }

        allTraders.reverse();

        // for (const trader of allTraders) {
        //     const { address, trade_count, pnl, volume } = trader;
        //     const target = trade_count >= 50 && trade_count <= 1000 ? 'Y' : 'N';
        //     console.log("current time: ", moment().utc().format('YYYY-MM-DD HH:mm:ss'));
        //     try {
        //         // Use upsert to insert or update the trader
        //         await TopTrader.upsert({
        //             address,
        //             tradecount: trade_count,
        //             '7d': pnl,
        //             tokenvalue: volume,
        //             target_range: target,
        //             update_dt: moment().utc().format('YYYY-MM-DD HH:mm:ss'),
        //         });
        //         console.log(`Upserted trader with address: ${address}`);
        //     } catch (err) {
        //         console.error(`Error processing trader ${address}: `, err);
        //     }
        // }
        res.status(200).send(allTraders);
    } catch (error) {
        console.error('error fetching result', error);
        res.status(400).send(error);
    }
});
router.get('/resettraders', async function(req, res, next) {
    try {
        const limit = 10; // Limit for batch processing (adjust as needed)
        let offset = 0;

        console.log(`Fetching data with offset: ${offset}`);

        // Fetch traders from the database
        const traders = await TopTrader.findAll({
            where: {}, // Add conditions if necessary
        });

        if (!traders || traders.length === 0) {
            console.log(`No more data found at offset ${offset}`);
        } else {
            // Iterate through the fetched traders
            for (const trader of traders) {
                // Check and update `target_skip` if null
                if (trader.target_skip === null) {
                    console.log(`Updating target_skip for trader with ID: ${trader.id}`);
                    trader.target_skip = 'N';
                    await trader.save(); // Save the updated trader back to the database
                }
                // Check and update `target_range_field` based on the range
                if (trader.tradecount >= 50 && trader.tradecount <= 1000) {
                    console.log(`Updating target_range 'Y' for trader with ID: ${trader.id}, ${trader.tradecount}`);
                    trader.target_range = 'Y'; // Assuming `target_range_field` is the column to update
                } else {
                    console.log(`Updating target_range to 'N' for trader with ID: ${trader.id}, ${trader.tradecount}`);
                    trader.target_range = 'N';
                }
                await trader.save(); // Save the updated trader back to the database
            }
        }

        res.status(200).send("Complete resetting traders");
    } catch (error) {
        console.error('Error fetching result:', error);
        res.status(400).send(error);
    }

});
router.get('/resetskip', async function(req, res) {
    try {
        // Fetch traders from the database
        const traders = await TopTrader.findAll({
            where: {}, // Add conditions if necessary
        });

        if (!traders || traders.length === 0) {
            console.log(`No traders found`);
        } else {
            // Iterate through the fetched traders
            for (const trader of traders) {
                trader.target_skip = 'N';
                await trader.save();
            }
        }

        res.status(200).send("Completed skip reset for all traders");
    } catch (error) {
        console.error('Error fetching result:', error);
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

//view txhistory of user and temporarily save it in memory for further processing
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
        res.status(500).send('failed to fetch tx history of user');
    }
});
router.get('/processonly', async function(req, res) {
    try {
        const txData = await processTransactionsOnly(tempTxHistory, tempUserNum, tempUserAddress);
        res.status(200).json(txData);
    } catch (error) {
        console.error("failed to process transaction history of user", error);
        res.status(500).send("failed to process transaction history of user", error);
    }
});

module.exports = {
    birdeyeRouter: router,
    getTraders,
    processTraders,
    processTransactionData,
    processUpnl,
    getExtraPnl,
    getSolanaPrice,
    // setTarget,
    getExtraPnlDay
};
