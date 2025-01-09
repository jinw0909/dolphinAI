const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return  sequelize.define('Token', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true, // Ensure the address is unique
        },
        symbol: {
            type: DataTypes.STRING,
            allowNull: true, // Allow null if the token name isn't available immediately
        },
        icon: {
            type: DataTypes.STRING(500),
            allowNull: true, // URL or path to the token's icon, can be null
        },
        price: {
            type: DataTypes.FLOAT,
            allowNull: true
        },
        target: {
            type: DataTypes.STRING,
            defaultValue: 'N'
        }
    }, {
        tableName: 'Tokens', // Explicitly set the table name
        timestamps: false, // Disable automatic timestamps (`createdAt` and `updatedAt`)
    });
};
