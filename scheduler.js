const cron = require('node-cron'); // Import node-cron for scheduling
const { getTraders, processTraders, processTransactionData, processUpnl, getExtraPnl, getSolanaPrice, setTarget, getExtraPnlDay } = require('./routes/birdeye'); // Import the function
const { getIcon, getPrice } = require('./routes/tokens');
const { clean } = require('./routes/cleaner');
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
cron.schedule('3 * * * *', async () => {
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
cron.schedule('24 * * * *', async () => {
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
cron.schedule('31 * * * *', async () => {
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
// step 7. getSolanaPrice
cron.schedule('33 * * * *', async () => {
    const now = new Date();
    const currentTime = now.toISOString(); // Log the current time in ISO format
    console.log(`Running getSolanaPrice() at ${currentTime}`);
    try {
        await getSolanaPrice(); // Call the function
        console.log('getSolanaPrice() completed successfully');
    } catch (error) {
        console.error('Error during getSolanaPrice():', error.message);
    }
});
// step 8. getExtraPnl
cron.schedule('36 * * * *', async () => {
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
cron.schedule('42 * * * *', async () => {
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
cron.schedule('44 * * * *', async () => {
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
cron.schedule('50 */6 * * *', async () => {
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
