const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('TopTrader', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        tradecount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        '1d': {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        '7d': {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        '30d': {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        tokenvalue: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        target: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'N'
        },
        show: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'N'
        },
        target_confirm: {
            type: DataTypes.STRING,
            defaultValue: 'N'
        },
        target_range: {
            type: DataTypes.STRING,
            defaultValue: 'N'
        },
        target_skip: {
            type: DataTypes.STRING,
            defaultValue: 'N'
        },
        winrate: {
            type: DataTypes.FLOAT,
        },
        total_pnl: {
            type: DataTypes.FLOAT
        },
        total_pnl_rate: {
            type: DataTypes.FLOAT
        },
        sol_amount: {
            type: DataTypes.FLOAT
        },
        sol_balance: {
            type: DataTypes.FLOAT
        },
        '1d_rate': {
            type: DataTypes.FLOAT,
        },
        '7d_rate': {
            type: DataTypes.FLOAT,
        },
        '30d_rate': {
            type: DataTypes.FLOAT,
        },
        '30d_buy_count': {
            type: DataTypes.INTEGER
        },
        '30d_sell_count': {
            type: DataTypes.INTEGER
        },
        '30d_trade_count': {
            type: DataTypes.INTEGER
        },
        '1d_pnl' : {
            type: DataTypes.FLOAT,
        },
        '7d_pnl': {
            type: DataTypes.FLOAT
        },
        '30d_pnl' : {
            type: DataTypes.FLOAT
        },
        '7d_trade_count': {
            type: DataTypes.INTEGER,
        },
        '7d_buy_count': {
            type: DataTypes.INTEGER
        },
        '7d_sell_count': {
            type: DataTypes.INTEGER
        },
        '7d_token_count': {
            type: DataTypes.INTEGER,
        },
        '7d_cost': {
            type: DataTypes.FLOAT
        },
        '7d_pnl_per_token' : {
            type: DataTypes.FLOAT
        },
        '7d_cost_per_token': {
            type: DataTypes.FLOAT
        },
        '7d_upnl': {
            type: DataTypes.FLOAT
        },
        insert_dt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        update_dt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        }
    }, {
        tableName: 'Top_Trader',
        indexes: [
            {
                fields: ['address', 'tradecount'], // Composite index
            },
        ],
        timestamps: false,
    });
};
