const express = require('express');
const router = express.Router();
const { Tokens } = require('../models');
const axios = require('axios');

// Define getIcon function
const getIcon = async () => {
    // Step 1: Fetch tokens where `icon` is null
    const tokens = await Tokens.findAll({
        where: { icon: null }, // Target tokens with no icon
    });

    if (!tokens || tokens.length === 0) {
        console.log('No tokens found with a null icon');
        return 'No tokens found with a null icon';
    }

    // Step 2: Iterate over tokens and fetch icon data
    for (const token of tokens) {
        const options = {
            method: 'GET',
            url: 'https://public-api.birdeye.so/defi/v3/token/meta-data/single',
            params: { address: token.address },
            headers: {
                accept: 'application/json',
                'x-chain': 'solana',
                'X-API-KEY': '334a0b3f35d34690a336afd02073ee29',
            },
        };

        try {
            const result = await axios.request(options);
            const data = result.data.data;

            // Step 3: Update the `icon` field in the Tokens table
            if (data.logo_uri) {
                await token.update({
                    icon: data.logo_uri, // Update with the fetched icon URL
                });

                console.log(`Updated token: ${token.symbol} with icon: ${data.logo_uri}`);
            } else {
                console.warn(`No icon found for token: ${token.symbol}`);
                await token.update({
                    icon: 'noimage'
                });
            }
        } catch (err) {
            console.error(`Failed to fetch or update icon for token: ${token.symbol}`, err.message);
        }
    }

    return 'Token icons updated successfully';
};

// Define getPrice function
const getPrice = async () => {
    // Step 1: Fetch tokens with target = 'Y'
    const tokens = await Tokens.findAll({
        where: { target: 'Y' },
    });

    if (!tokens || tokens.length === 0) {
        console.log('No tokens found with target = Y');
        return 'No tokens found with target = Y';
    }

    // Step 2: Group tokens into chunks of 100 addresses
    const tokenChunks = [];
    const tokenList = tokens.map(token => token.address);

    while (tokenList.length) {
        tokenChunks.push(tokenList.splice(0, 100));
    }

    // Step 3: Fetch prices for each chunk and update tokens
    for (const chunk of tokenChunks) {
        try {
            // Send a POST request to the multi_price API
            const options = {
                method: 'POST',
                url: 'https://public-api.birdeye.so/defi/multi_price',
                headers: {
                    accept: 'application/json',
                    'x-chain': 'solana',
                    'content-type': 'application/json',
                    'X-API-KEY': '334a0b3f35d34690a336afd02073ee29',
                },
                data: {
                    list_address: chunk.join(','), // Convert chunk to comma-separated string
                },
            };

            const result = await axios.request(options);
            const priceData = result.data.data;

            // Step 4: Update prices in the database
            for (const [address, data] of Object.entries(priceData)) {
                const token = tokens.find(t => t.address === address);
                if (token) {
                    await token.update({ price: data.value });
                    console.log(`Updated token: ${token.symbol} with price: ${data.value}`);
                }
            }
        } catch (err) {
            console.error(`Failed to fetch or update prices for chunk: ${chunk}`, err.message);
        }
    }

    return 'Token prices updated successfully';
};

// Add getIcon to router
router.get('/icon', async (req, res) => {
    try {
        const message = await getIcon();
        res.status(200).send(message);
    } catch (error) {
        console.error('Error in getIcon:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// Add getPrice to router
router.get('/price', async (req, res) => {
    try {
        const message = await getPrice();
        res.status(200).send(message);
    } catch (error) {
        console.error('Error in getPrice:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// Export the router and functions
module.exports = {
    tokensRouter: router,
    getPrice,
    getIcon,
};
