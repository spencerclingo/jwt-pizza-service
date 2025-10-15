const { DB } = require('../../src/database/database.js');

// Export an async function for Jest to run
module.exports = async () => {
    let connection;
    try {
        connection = await DB.getConnection();

        console.log('\nDropping test database...');
        await connection.query(`DROP SCHEMA IF EXISTS pizza_test_db`);
        console.log('✅ Test database dropped.');

    } catch (error) {
        console.error('Error during database teardown:', error);
        process.exit(1); // Exit with a failure code
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};