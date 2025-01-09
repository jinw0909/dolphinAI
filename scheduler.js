const cron = require('node-cron'); // Import node-cron for scheduling
const { getTraders, processTraders, processTransactionData, processUpnl, getExtraPnl } = require('./routes/birdeye'); // Import the function
const { getIcon, getPrice } = require('./routes/tokens');

// Schedule the function using node-cron
// step 1.
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

// step 2.
cron.schedule('5 * * * *', async () => {
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

// step 3.
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

// step 4.
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

// step 5.
cron.schedule('25 * * * *', async () => {
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

// step 6.
cron.schedule('35 * * * *', async () => {
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

// step 7.
cron.schedule('40 * * * *', async () => {
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

console.log('Scheduler initialized');
