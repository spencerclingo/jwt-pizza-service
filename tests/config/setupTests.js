jest.mock('../../src/config.js', () => {
    const originalModule = jest.requireActual('../../src/config.js');

    return {
        ...originalModule,
        db: {
            ...originalModule.db,
            connection: {
                ...originalModule.db.connection,
                database: 'pizza_test_db',
            },
        },
    };
});