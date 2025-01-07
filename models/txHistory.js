const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('TxHistory', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        txhash: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        symbol: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        symbol_address: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        position: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        time: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        datetime: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        cost: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        balance: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        size: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        pnl: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        pnl_percentage: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        user_num: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        user_address: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        hold_amount: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        avg_price: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
    }, {
        tableName: 'Trade_History',
        timestamps: false,
    });
};
