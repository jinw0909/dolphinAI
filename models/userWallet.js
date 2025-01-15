const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('UserWallet', {
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
            allowNull: false,
        },
        symbol: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        symbol_address: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING,
        },
        cost: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        holding: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        size: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },
        pnl: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },
        pnl_percentage: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },
        icon: {
            type: DataTypes.STRING,
        },
        current: {
            type: DataTypes.STRING,
            defaultValue: 'N',
        },
        show: {
            type: DataTypes.STRING,
            defaultValue: 'N',
        },
    }, {
        tableName: 'User_Wallet',
        timestamps: false, // Disable createdAt and updatedAt
        indexes: [
            {
                unique: true,
                fields: ['user_address', 'symbol_address'], // Ensure uniqueness for user_address and symbol_address
            },
        ],
    });
};
