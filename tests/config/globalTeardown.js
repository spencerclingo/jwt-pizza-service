const { DB } = require('../../src/database/database.js');

// Export an async function for Jest to run
module.exports = async () => {
    let connection;
    try {
        // 1. Get the database connection
        connection = await DB.getConnection();

        // 2. Execute the query to drop the schema
        console.log('\nDropping test database...');
        await connection.query(`DROP SCHEMA IF EXISTS pizzaTest`);
        console.log('✅ Test database dropped.');

    } catch (error) {
        console.error('Error during database teardown:', error);
        process.exit(1); // Exit with a failure code
    } finally {
        // 3. Always close the connection to prevent a hanging process
        if (connection) {
            await connection.end();
        }
    }
};