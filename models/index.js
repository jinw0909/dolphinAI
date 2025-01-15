const { Sequelize } = require('sequelize');
const TopTraderModel = require('./topTrader');
const TxHistoryModel = require('./txHistory');
const TokensModel = require('./tokens');
const TradedTokensModel = require('./tradedTokens');
const UserWalletModel = require('./userWallet');

// const sequelize = new Sequelize('dolphin', 'admin', 'qwer1234', {
//     host: 'database-2.c5eaqgsmmklh.ap-northeast-2.rds.amazonaws.com',
//     dialect: 'mysql',
// });

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    timezone: '+09:00',
    dialectOptions: {
        timezone: "+09:00", // DB에서 가져올 때 시간 설정
    },
    logging: false
});

// Initialize models
const TopTrader = TopTraderModel(sequelize);
const TxHistory = TxHistoryModel(sequelize);
const Tokens = TokensModel(sequelize);
const TradedTokens = TradedTokensModel(sequelize);
const UserWallet = UserWalletModel(sequelize);

TradedTokens.belongsTo(Tokens, {
    foreignKey: 'symbol_address',
    targetKey: 'address',
    constraints: false,
});

Tokens.hasMany(TradedTokens, {
    foreignKey: 'symbol_address',
    sourceKey: 'address',
    constraints: false
});

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection to the database established successfully.');
        // Create the table if it doesn't exist
        // await sequelize.sync({alter: true}); // Set `force: true` to recreate the table
        await sequelize.sync(); // Set `force: true` to recreate the table
        console.log('All models were synchronized successfully.');
    } catch (error) {
        console.error('Unable to connect to the database or sync models:', error);
    }
})();

// Export Sequelize instance and models
module.exports = {
    sequelize,
    TopTrader,
    TxHistory,
    Tokens,
    TradedTokens,
    UserWallet
};
