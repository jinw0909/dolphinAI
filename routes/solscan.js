var express = require('express');
var router = express.Router();

const API_URL = "https://api.solscan.io/account/defi-activity";
const API_KEY = "YourApiKeyHere"; // Replace with your Solscan API key
const WALLET_ADDRESS = "YourWalletAddressHere"; // Replace with the wallet address
const OFFSET = 0; // Pagination offset
const LIMIT = 10; // Number of records to fetch


/* GET home page. */
router.get('/', async function(req, res, next) {

    const response = await fetch('https://api.solscan.io/account/defi-activity?address=37KGftRzq24e8oKjxJ4kYNPwC4yv1YJYBcyxsXRDcetu&offset=<offset>&limit=<limit>', {
        method: 'GET',
        headers: {},
    });
    const data = await response.json();
    res.status(200).send(data);
});

module.exports = router;
