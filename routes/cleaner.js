// const express = require('express');
// const router = express.Router();
// const { TopTrader, TxHistory, Tokens, TradedTokens, sequelize } = require('../models');
// const { Op } = require('sequelize');
// const clean = async function () {
//     try {
//         // Start a transaction
//         const transaction = await sequelize.transaction();
//
//         // Step 1: Fetch and delete rows from the Tokens table
//         const deletedTokens = await Tokens.findAll({
//             where: {
//                 ref: { [Op.ne]: 'Y' }, // ref is not 'Y'
//                 target: { [Op.ne]: 'Y' } // target is not 'Y'
//             },
//             attributes: ['address'], // Only retrieve the address field
//             transaction
//         });
//
//         const addressesToDelete = deletedTokens.map(token => token.address);
//
//         // If no addresses to delete, exit early
//         if (addressesToDelete.length === 0) {
//             console.log('No matching tokens to delete.');
//             await transaction.commit();
//             return;
//         }
//
//         // Delete the matching rows from the Tokens table
//         await Tokens.destroy({
//             where: {
//                 address: addressesToDelete
//             },
//             transaction
//         });
//
//         // Step 2: Delete rows from TxHistory table
//         await TxHistory.destroy({
//             where: {
//                 symbol_address: addressesToDelete
//             },
//             transaction
//         });
//
//         // Step 3: Delete rows from TradedTokens table
//         await TradedTokens.destroy({
//             where: {
//                 symbol_address: addressesToDelete
//             },
//             transaction
//         });
//
//         // Step 4: Delete rows from TopTrader table
//         // Get IDs of the most recent 200 rows where target != 'Y' and show != 'Y'
//         const recentTopTraderIds = await TopTrader.findAll({
//             where: {
//                 target: { [Op.ne]: 'Y' }, // target is not 'Y'
//                 show: { [Op.ne]: 'Y' } // show is not 'Y'
//             },
//             order: [['insert_dt', 'DESC']], // Order by most recent
//             limit: 300, // Get the most recent 300 rows
//             attributes: ['id'], // Fetch only IDs
//             transaction
//         });
//
//         const idsToExclude = recentTopTraderIds.map(row => row.id);
//
//         // Delete rows except the most recent 200
//         await TopTrader.destroy({
//             where: {
//                 target: { [Op.ne]: 'Y' }, // target is not 'Y'
//                 show: { [Op.ne]: 'Y' }, // show is not 'Y'
//                 id: { [Op.notIn]: idsToExclude } // Exclude recent 200 rows
//             },
//             transaction
//         });
//
//         // Commit the transaction
//         await transaction.commit();
//
//         console.log('Cleanup successful.');
//     } catch (error) {
//         // Rollback the transaction in case of error
//         console.error('Error during cleanup:', error);
//         await transaction.rollback();
//     }
// };
//
// /* GET home page. */
// router.get('/', function (req, res, next) {
//     res.render('index', { title: 'Express' });
// });
//
//
// // Expose the clean function for external usage (if needed)
// router.get('/clean', async function (req, res, next) {
//     try {
//         await clean();
//         res.status(200).send('Cleanup process completed.');
//     } catch (error) {
//         res.status(500).send('Error during cleanup.');
//     }
// });
//
// module.exports = {
//     cleanerRouter: router,
//     clean
// };
const express = require('express');
const router = express.Router();
const { TxHistory, Tokens, TradedTokens, sequelize } = require('../models');

const clean = async function () {
    try {
        // Start a transaction
        const transaction = await sequelize.transaction();

        // Step 1: Delete rows from the Tokens table where current is 'N'
        const tokensDeletedCount = await Tokens.destroy({
            where: {
                target: 'N' // current is 'N'
            },
            transaction
        });
        console.log(`Tokens table: Deleted ${tokensDeletedCount} rows.`);

        // Step 2: Delete rows from the TradedTokens table where current is 'N'
        const tradedTokensDeletedCount = await TradedTokens.destroy({
            where: {
                current: 'N' // current is 'N'
            },
            transaction
        });
        console.log(`TradedTokens table: Deleted ${tradedTokensDeletedCount} rows.`);

        // Step 3: Delete rows from the TxHistory table where current is 'N'
        const txHistoryDeletedCount = await TxHistory.destroy({
            where: {
                current: 'N' // current is 'N'
            },
            transaction
        });
        console.log(`TxHistory table: Deleted ${txHistoryDeletedCount} rows.`);

        // Commit the transaction
        await transaction.commit();
        console.log('Cleanup process completed successfully.');
    } catch (error) {
        // Rollback the transaction in case of error
        console.error('Error during cleanup process:', error);
        await sequelize.transaction.rollback();
    }
};

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

// Expose the clean function for external usage (if needed)
router.get('/clean', async function (req, res, next) {
    try {
        await clean();
        res.status(200).send('Cleanup process completed.');
    } catch (error) {
        res.status(500).send('Error during cleanup.');
    }
});

module.exports = {
    cleanerRouter: router,
    clean
};
