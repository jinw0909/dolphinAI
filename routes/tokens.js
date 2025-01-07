const express = require('express');
const router = express.Router();
const { Tokens } = require('../models');
const axios = require('axios');

/* GET home page. */
/* GET home page. */
router.get('/icon', async function (req, res, next) {
    try {
        // Step 1: Fetch tokens where `icon` is null
        const tokens = await Tokens.findAll({
            where: { icon: null }, // Target tokens with no icon
        });

        if (!tokens || tokens.length === 0) {
            console.log('No tokens found with a null icon');
            return res.status(404).send('No tokens found with a null icon');
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

        res.status(200).send('Token icons updated successfully');
    } catch (error) {
        console.error('Error updating token icons:', error);
        res.status(500).send('Internal Server Error');
    }
});


/* GET home page. */
router.get('/price', async function (req, res, next) {
    try {
        // Step 1: Fetch tokens with target = 'Y'
        const tokens = await Tokens.findAll({
            where: { target: 'Y' },
        });

        if (!tokens || tokens.length === 0) {
            return res.status(404).send('No tokens found with target = Y');
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

        res.status(200).send('Token prices updated successfully');
    } catch (error) {
        console.error('Error updating token prices:', error);
        res.status(500).send('Internal Server Error');
    }
});


module.exports = router;