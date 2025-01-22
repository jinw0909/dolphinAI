const cron = require('node-cron'); // Import node-cron for scheduling
const { getTraders, processTraders, processTransactionData, processUpnl, getExtraPnl, getSolanaPrice, getExtraPnlDay } = require('./routes/birdeye'); // Import the function
const { getIcon, getPrice } = require('./routes/tokens');
const { clean } = require('./routes/cleaner');
const { setTarget } = require('./routes/target');
const { processPortfolio } = require('./routes/portfolio');
// Schedule the function using node-cron
// step 1. getTraders
cron.schedule('0 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running getTraders() at ${currentTime}`);
    try {
        await getTraders(); // Call the function
        console.log('getTraders() completed successfully');
    } catch (error) {
        console.error('Error during getTraders():', error.message);
    }
});
// step 2. processTraders
cron.schedule('2 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running processTraders() at ${currentTime}`);
    try {
        await processTraders(); // Call the function
        console.log('processTraders() completed successfully');
    } catch (error) {
        console.error('Error during processTraders():', error.message);
    }
});
// step 3. processTransactionData (main function)
cron.schedule('10 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running processTransactionData() at ${currentTime}`);
    try {
        await processTransactionData(); // Call the function
        console.log('processTranasactionData() completed successfully');
    } catch (error) {
        console.error('Error during processTransactionData():', error.message);
    }
});
// step 4. getPrice
cron.schedule('20 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running getPrice() at ${currentTime}`);
    try {
        await getPrice(); // Call the function
        console.log('getPrice() completed successfully');
    } catch (error) {
        console.error('Error during getPrice():', error.message);
    }
});
// step 5. getIcon
cron.schedule('23 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running getIcon() at ${currentTime}`);
    try {
        await getIcon(); // Call the function
        console.log('getIcon() completed successfully');
    } catch (error) {
        console.error('Error during getIcon():', error.message);
    }
});
// step 6. processUpnl
cron.schedule('28 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running processUpnl() at ${currentTime}`);
    try {
        await processUpnl(); // Call the function
        console.log('processUpnl() completed successfully');
    } catch (error) {
        console.error('Error during processUpnl():', error.message);
    }
});
// step 7. processPortfolio
cron.schedule('30 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running processPortfolio() at ${currentTime}`);
    try {
        await processPortfolio(); // Call the function
        console.log('processPortfolio() completed successfully');
    } catch (error) {
        console.error('Error during processPortfolio():', error.message);
    }
});
// step 8. getExtraPnl
cron.schedule('35 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running getExtraPnl() at ${currentTime}`);
    try {
        await getExtraPnl(); // Call the function
        console.log('getExtraPnl() completed successfully');
    } catch (error) {
        console.error('Error during getExtraPnl():', error.message);
    }
});
// step 9. setTarget
cron.schedule('40 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running setTarget() at ${currentTime}`);
    try {
        await setTarget(); // Call the function
        console.log('setTarget() completed successfully');
    } catch (error) {
        console.error('Error during setTarget():', error.message);
    }
});
// step 10. clean
cron.schedule('42 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running clean() at ${currentTime}`);
    try {
        await clean(); // Call the function
        console.log('clean() completed successfully');
    } catch (error) {
        console.error('Error during clean():', error.message);
    }
});
// step 11. getExtraPnlDay
cron.schedule('50 0,6,12,18 * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running getExtraPnlDay() at ${currentTime}`);
    try {
        await getExtraPnlDay(); // Call the function
        console.log('getExtraPnlDay() completed successfully');
    } catch (error) {
        console.error('Error during getExtraPnlDay():', error.message);
    }
});

console.log('Scheduler initialized');
