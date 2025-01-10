const express = require('express');
const router = express.Router();
const { TopTrader, TxHistory, Tokens, TradedTokens, sequelize} = require('../models');

const clean = async function() {
    //db delete logic

}

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

module.exports = router;
