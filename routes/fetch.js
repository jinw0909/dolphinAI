var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', async function(req, res, next) {

    const response = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
        method: 'GET',
        headers: {},
    });
    const data = await response.json();
    res.status(200).send(data);
});

router.get('/boosts', async function(req, res, next) {
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
        method: 'GET',
        headers: {},
    });
    const data = await response.json();
    res.status(200).send(data);
});

router.get('/token', async function(req, res) {
    const response = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN')
    const data = await response.json();
    res.status(200).send(data);
});

module.exports = router;
