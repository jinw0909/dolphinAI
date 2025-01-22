const express = require('express');
const router = express.Router();
const { TxHistory, Tokens, TradedTokens, UserWallet, sequelize, TopTrader} = require('../models');

const setTarget = async function() {

    //Reset 'target to 'N' for all rows in both tables
    await TopTrader.update({ target: 'N'}, { where: {} });
    await TradedTokens.update({ current: 'N'}, { where: {} });
    await Tokens.update({target: 'N'}, {where: {}});
    await TxHistory.update({ current: 'N'}, {where: {}});
    await UserWallet.update({current: 'N'}, {where: {}});

    //Bulk update 'show' to 'Y' for TopTrader where 'target' is 'Y'
    await TopTrader.update(
        { target: 'Y' },
        { where: { show: 'Y' }}
    );

    //Bulk update 'current' to 'Y' for TradedTokens where 'show' is 'Y'
    await TradedTokens.update(
        { current: 'Y' },
        { where: { show: 'Y' }}
    );

    await Tokens.update(
        { target: 'Y'},
        { where: { ref: 'Y'}}
    );

    await TxHistory.update(
        { current: 'Y'},
        { where: { show: 'Y'}}
    );

    await UserWallet.update(
        { current: 'Y'},
        { where: { show: 'Y'}}
    );

    // await CrawledWallet.update(
    //     { current: 'Y' },
    //     { where: { show: 'Y'}}
    // )
}
// const clean = async function () {
//     try {
//         // Start a transaction
//         const transaction = await sequelize.transaction();
//
//         // Step 1: Delete rows from the Tokens table where current is 'N'
//         const tokensDeletedCount = await Tokens.destroy({
//             where: {
//                 target: 'N' // current is 'N'
//             },
//             transaction
//         });
//         console.log(`Tokens table: Deleted ${tokensDeletedCount} rows.`);
//
//         // Step 2: Delete rows from the TradedTokens table where current is 'N'
//         const tradedTokensDeletedCount = await TradedTokens.destroy({
//             where: {
//                 current: 'N' // current is 'N'
//             },
//             transaction
//         });
//         console.log(`TradedTokens table: Deleted ${tradedTokensDeletedCount} rows.`);
//
//         // Step 3: Delete rows from the TxHistory table where current is 'N'
//         const txHistoryDeletedCount = await TxHistory.destroy({
//             where: {
//                 current: 'N' // current is 'N'
//             },
//             transaction
//         });
//         console.log(`TxHistory table: Deleted ${txHistoryDeletedCount} rows.`);
//
//         const userWalletDeletedCount = await UserWallet.destroy({
//             where: {
//                 current: 'N' // current is 'N'
//             },
//             transaction
//         });
//         console.log(`UserWallet table: Deleted ${userWalletDeletedCount} rows.`);
//
//         // Commit the transaction
//         await transaction.commit();
//         console.log('Cleanup process completed successfully.');
//     } catch (error) {
//         // Rollback the transaction in case of error
//         console.error('Error during cleanup process:', error);
//         await sequelize.transaction.rollback();
//     }
// };

/* GET home page. */
router.get('/', async function (req, res, next) {
    try {
        await setTarget();
        res.status(200).send('complete setting target completed.');
    } catch (error) {
        res.status(500).send('Error during setting target.');
    }
});

module.exports = {
    targetRouter: router,
    // clean,
    setTarget
};
