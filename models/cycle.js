const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('cycle', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false
        },
        insert_dt: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        cycle: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        external_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        profitability: {
            type: DataTypes.FLOAT,
        },
        stability: {
            type: DataTypes.FLOAT
        },
        reliability: {
            type: DataTypes.FLOAT
        },
        adaptability: {
            type: DataTypes.FLOAT
        },
        pnl_pattern: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        trade_pattern: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        rising: {
            type: DataTypes.FLOAT,
        },
        declining: {
            type: DataTypes.FLOAT
        },
        rough: {
            type: DataTypes.FLOAT,
        },
    }, {
        tableName: 'Cycle',
        indexes: [
            {
                fields: ['address'], // Composite index
            },
        ],
        timestamps: false,
    });
};
