const express = require('express');
const router = express.Router();
const { TopTrader, UserWallet, TradedTokens } = require('../models');
const axios = require("axios");

// const processPortfolio = async () => {
//     try {
//         // Set all rows in User_Wallet 'show' field to 'N'
//         await UserWallet.update({ show: 'N' }, { where: {} });
//
//         const rows = await TopTrader.findAll({
//             where: {
//                 show: 'Y',
//             },
//             order: [['insert_dt', 'DESC']]
//         });
//
//         if (rows.length === 0) {
//             console.log('No trader to process extra pnl');
//             return;
//         }
//
//         for (const row of rows) {
//             const options = {
//                 method: 'GET',
//                 url: 'https://public-api.birdeye.so/v1/wallet/token_list',
//                 params: { wallet: row.address },
//                 headers: {
//                     accept: 'application/json',
//                     'x-chain': 'solana',
//                     'X-API-KEY': process.env.X_API_KEY,
//                 },
//             };
//
//             let totalSolAmount = 0;
//             let totalSolBalance = 0;
//
//             try {
//                 const response = await axios.request(options);
//                 const tokenList = response.data.data.items;
//
//                 // Check if tokenList is null or empty
//                 if (!tokenList || tokenList.length === 0) {
//                     console.warn(`Token list is empty for trader ${row.address}`);
//
//                     // Update the TopTrader row with show='Y' and target_skip='Y'
//                     await TopTrader.update({
//                         show: 'N',
//                         target_skip: 'Y',
//                     }, {
//                         where: { id: row.id },
//                     });
//
//                     continue; // Skip further processing for this trader
//                 }
//
//                 for (const token of tokenList) {
//                     try {
//                         const {
//                             address: symbol_address,
//                             name,
//                             priceUsd: cost,
//                             uiAmount: holding,
//                             valueUsd: size,
//                             logoURI: icon,
//                             symbol
//                         } = token;
//
//                         // Skip tokens without valueUsd
//                         if (!size) continue;
//
//                         // Validate 'symbol' to avoid null violations
//                         if (!symbol) {
//                             console.warn(`Skipping token due to null symbol for address ${symbol_address}`);
//                             continue; // Skip processing this token
//                         }
//
//                         // Process SOL-specific logic
//                         const solAddresses = [
//                             'So11111111111111111111111111111111111111111',
//                             'So11111111111111111111111111111111111111112'
//                         ];
//
//                         if (solAddresses.includes(symbol_address)) {
//                             totalSolAmount += holding || 0;
//                             totalSolBalance += (holding || 0) * (cost || 0);
//                         }
//
//                         // Check if a row exists with the same user_address and symbol_address
//                         const existingRow = await UserWallet.findOne({
//                             where: {
//                                 user_address: row.address,
//                                 symbol_address: symbol_address,
//                             },
//                         });
//
//                         if (existingRow) {
//                             // Update the existing row
//                             await UserWallet.update({
//                                 symbol,
//                                 name,
//                                 cost,
//                                 holding,
//                                 size,
//                                 icon,
//                                 show: 'Y',
//                             }, {
//                                 where: {
//                                     id: existingRow.id,
//                                 },
//                             });
//                         } else {
//                             // Insert a new row
//                             await UserWallet.create({
//                                 user_address: row.address,
//                                 user_num: row.id,
//                                 symbol,
//                                 symbol_address,
//                                 name,
//                                 cost,
//                                 holding,
//                                 size,
//                                 icon,
//                                 show: 'Y',
//                             });
//                         }
//                     } catch (tokenError) {
//                         console.error(`Failed to process token for address ${row.address}:`, tokenError.message);
//                         // Continue to the next token
//                     }
//                 }
//
//
//                 console.log(`SOL Amount: ${totalSolAmount}`);
//                 console.log(`SOL Balance (USD): ${totalSolBalance}`);
//
//                 await TopTrader.update({
//                     'sol_amount': totalSolAmount,
//                     'sol_balance': totalSolBalance
//                 }, {
//                     where: { id: row.id }
//                 });
//             } catch (apiError) {
//                 console.error(`Failed to fetch portfolio data for trader ${row.address}:`, apiError.message);
//             }
//         }
//
//         console.log("Portfolio data processed successfully.");
//     } catch (err) {
//         console.error("Error while fetching and updating portfolio data:", err.message);
//     }
// }
// const processPortfolio = async () => {
//     try {
//         // Set all rows in User_Wallet 'show' field to 'N'
//         await UserWallet.update({ show: 'N' }, { where: {} });
//
//         const rows = await TopTrader.findAll({
//             where: {
//                 show: 'Y',
//             },
//             order: [['insert_dt', 'DESC']],
//         });
//
//         if (rows.length === 0) {
//             console.log('No trader to process extra pnl');
//             return;
//         }
//
//         for (const row of rows) {
//             const options = {
//                 method: 'GET',
//                 url: 'https://public-api.birdeye.so/v1/wallet/token_list',
//                 params: { wallet: row.address },
//                 headers: {
//                     accept: 'application/json',
//                     'x-chain': 'solana',
//                     'X-API-KEY': process.env.X_API_KEY,
//                 },
//             };
//
//             let totalSolAmount = 0;
//             let totalSolBalance = 0;
//
//             try {
//                 const response = await axios.request(options);
//                 const tokenList = response.data.data.items;
//
//                 // Check if tokenList is null or empty
//                 if (!tokenList || tokenList.length === 0) {
//                     console.warn(`Token list is empty for trader ${row.address}`);
//
//                     // Update the TopTrader row with show='N' and target_skip='Y'
//                     await TopTrader.update({
//                         show: 'N',
//                         target_skip: 'Y',
//                     }, {
//                         where: { id: row.id },
//                     });
//
//                     continue; // Skip further processing for this trader
//                 }
//
//                 // Aggregate tokens by symbol
//                 const aggregatedTokens = tokenList.reduce((acc, token) => {
//                     const {
//                         address: symbol_address,
//                         name,
//                         priceUsd: cost,
//                         uiAmount: holding,
//                         valueUsd: size,
//                         logoURI: icon,
//                         symbol,
//                     } = token;
//
//                     if (!name || !size) return acc; // Skip invalid tokens
//
//                     if (!acc[name]) {
//                         acc[name] = {
//                             name,
//                             symbol,
//                             symbol_address,
//                             cost, // Initialize cost
//                             holding,
//                             size,
//                             icon,
//                             count: 1, // Initialize count
//                         };
//                     } else {
//                         // Update running total for cost and increment count
//                         acc[name].cost = (acc[name].cost * acc[name].count + cost) / (acc[name].count + 1);
//                         acc[name].count += 1; // Increment count
//
//                         // Aggregate holding and size
//                         acc[name].holding += holding;
//                         acc[name].size += size;
//                     }
//
//                     return acc;
//                 }, {});
//
//
//                 // Process aggregated tokens
//                 for (const name in aggregatedTokens) {
//                     const tokenData = aggregatedTokens[name];
//
//                     // Process SOL-specific logic
//                     const solAddresses = [
//                         'So11111111111111111111111111111111111111111',
//                         'So11111111111111111111111111111111111111112',
//                     ];
//
//                     if (solAddresses.includes(tokenData.symbol_address)) {
//                         totalSolAmount += tokenData.holding || 0;
//                         totalSolBalance +=
//                             (tokenData.holding || 0) * (tokenData.cost || 0);
//                     }
//
//                     // Check if a row exists with the same user_address and symbol_address
//                     const existingRow = await UserWallet.findOne({
//                         where: {
//                             user_address: row.address,
//                             symbol_address: tokenData.symbol_address,
//                         },
//                     });
//
//                     // Check Traded_Tokens for pnl and pnl_percentage
//                     const tradedToken = await TradedTokens.findOne({
//                         where: {
//                             user_address: row.address,
//                             symbol: tokenData.symbol,
//                             show: 'Y',
//                         },
//                     });
//
//                     if (tradedToken) {
//                         console.log(`found match in the tradedToken of ${tradedToken.symbol} for user ${row.address}`);
//                     }
//
//                     const pnl = tradedToken ? tradedToken.pnl : 0;
//                     const pnl_percentage = tradedToken ? tradedToken.pnl_percentage : 0;
//
//                     if (existingRow) {
//                         // Update the existing row
//                         await UserWallet.update(
//                             {
//                                 ...tokenData,
//                                 show: 'Y',
//                                 pnl,
//                                 pnl_percentage,
//                             },
//                             {
//                                 where: {
//                                     id: existingRow.id,
//                                 },
//                             }
//                         );
//                     } else {
//                         // Insert a new row
//                         await UserWallet.create({
//                             user_address: row.address,
//                             user_num: row.id,
//                             ...tokenData,
//                             show: 'Y',
//                             pnl,
//                             pnl_percentage,
//                         });
//                     }
//                 }
//
//                 console.log(`SOL Amount: ${totalSolAmount} , user: ${row.address}`);
//                 console.log(`SOL Balance (USD): ${totalSolBalance} , user ${row.address}`);
//
//                 await TopTrader.update(
//                     {
//                         sol_amount: totalSolAmount,
//                         sol_balance: totalSolBalance,
//                     },
//                     {
//                         where: { id: row.id },
//                     }
//                 );
//             } catch (apiError) {
//                 console.error(
//                     `Failed to fetch portfolio data for trader ${row.address}:`,
//                     apiError.message
//                 );
//             }
//         }
//
//         console.log('Portfolio data processed successfully.');
//     } catch (err) {
//         console.error('Error while fetching and updating portfolio data:', err.message);
//     }
// };
const processPortfolio = async () => {
    try {
        // Set all rows in User_Wallet 'show' field to 'N'
        await UserWallet.update({ show: 'N' }, { where: {} });

        const rows = await TopTrader.findAll({
            where: {
                show: 'Y',
            },
            order: [['insert_dt', 'DESC']],
            //limit: 5,
        });

        if (rows.length === 0) {
            console.log('No trader to process extra pnl');
            return;
        }

        const result = [];

        for (const row of rows) {
            const options = {
                method: 'GET',
                url: 'https://public-api.birdeye.so/v1/wallet/token_list',
                params: { wallet: row.address },
                headers: {
                    accept: 'application/json',
                    'x-chain': 'solana',
                    'X-API-KEY': process.env.X_API_KEY,
                },
            };

            let totalSolAmount = 0;
            let totalSolBalance = 0;
            const tokens = [];

            try {
                const response = await axios.request(options);
                const tokenList = response.data.data.items;

                // Check if tokenList is null or empty
                if (!tokenList || tokenList.length === 0) {
                    console.warn(`Token list is empty for trader ${row.address}`);

                    // Update the TopTrader row with show='N' and target_skip='Y'
                    await TopTrader.update({
                        show: 'N',
                        target_skip: 'Y',
                    }, {
                        where: { id: row.id },
                    });

                    continue; // Skip further processing for this trader
                }

                const limitedTokenList = tokenList.slice(0, 20);

                // Process each token individually
                for (const token of limitedTokenList) {
                    const {
                        address: symbol_address,
                        name,
                        priceUsd: cost,
                        uiAmount: holding,
                        valueUsd: size,
                        logoURI: icon,
                        symbol,
                    } = token;

                    if (!name || !size) {
                        console.warn(`Skipping invalid token for trader ${row.address}`);
                        continue; // Skip invalid tokens
                    }

                    tokens.push({
                        symbol,
                        symbol_address,
                        name,
                        cost,
                        holding,
                        size,
                        icon,
                    });

                    // Process SOL-specific logic
                    const solAddresses = [
                        'So11111111111111111111111111111111111111111',
                        'So11111111111111111111111111111111111111112',
                    ];

                    if (solAddresses.includes(symbol_address)) {
                        totalSolAmount += holding || 0;
                        totalSolBalance += (holding || 0) * (cost || 0);
                    }

                    // Check if a row exists with the same user_address and symbol_address
                    const existingRow = await UserWallet.findOne({
                        where: {
                            user_address: row.address,
                            symbol_address: symbol_address,
                        },
                    });

                    // // Check Traded_Tokens for pnl and pnl_percentage
                    // const tradedToken = await TradedTokens.findOne({
                    //     where: {
                    //         user_address: row.address,
                    //         symbol_address: symbol_address,
                    //         show: 'Y',
                    //     },
                    // });
                    //
                    // const pnl = tradedToken ? tradedToken.pnl : 0;
                    // const pnl_percentage = tradedToken ? tradedToken.pnl_percentage : 0;

                    if (existingRow) {
                        // Update the existing row
                        await UserWallet.update(
                            {
                                symbol,
                                name,
                                cost,
                                holding,
                                size,
                                icon,
                                show: 'Y',
                                // pnl,
                                // pnl_percentage,
                            },
                            {
                                where: {
                                    id: existingRow.id,
                                },
                            }
                        );
                    } else {
                        // Insert a new row
                        await UserWallet.create({
                            user_address: row.address,
                            user_num: row.id,
                            symbol,
                            symbol_address,
                            name,
                            cost,
                            holding,
                            size,
                            icon,
                            show: 'Y',
                            // pnl,
                            // pnl_percentage,
                        });
                    }
                }

                console.log(`SOL Amount: ${totalSolAmount} , user: ${row.address}`);
                console.log(`SOL Balance (USD): ${totalSolBalance} , user: ${row.address}`);

                await TopTrader.update(
                    {
                        sol_amount: totalSolAmount,
                        sol_balance: totalSolBalance,
                    },
                    {
                        where: { id: row.id },
                    }
                );

                result.push({trader: row.address, tokens});
            } catch (apiError) {
                console.error(
                    `Failed to fetch portfolio data for trader ${row.address}:`,
                    apiError.message
                );
            }
        }

        console.log('Portfolio data processed successfully.');
        return result;
    } catch (err) {
        console.error('Error while fetching and updating portfolio data:', err.message);
    }
};

/* GET home page. */
router.get('/process/:address', function (req, res, next) {
    const userAddress = req.params.address;
    res.render('index', { title: 'Express' });
});

router.get('/process', async function(req, res) {
    try {
        const result = await processPortfolio();
        res.status(200).json(result);
    } catch (error) {
        console.error('error during portfolio processing of the top traders');
        res.status(500).send("error during portfolio processing of the top traders");
    }
});

module.exports = {
    portfolioRouter: router,
    processPortfolio
};
