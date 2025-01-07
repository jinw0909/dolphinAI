const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('TradedTokens', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        user_address: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        user_num: {
            type: DataTypes.INTEGER,
        },
        symbol: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        symbol_address: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        buy_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        sell_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        positive_sell_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        pnl: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        pnl_percentage: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        upnl: {
            type: DataTypes.FLOAT
        },
        cost: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        avg_price: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        holding: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },
        win_rate: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        current: {
            type: DataTypes.STRING,
            defaultValue: 'N'
        }
    }, {
        tableName: 'Traded_Tokens',
        timestamps: false, // Disable createdAt and updatedAt
        indexes: [
            {
                unique: true,
                fields: ['user_address', 'symbol_address'], // Ensure uniqueness for user_address and symbol_address
            },
        ],
    });
};
