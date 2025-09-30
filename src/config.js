module.exports = {
    // Use process.env for secrets, with a fallback for local development
    jwtSecret: process.env.JWT_SECRET,
    db: {
        connection: {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            connectTimeout: process.env.CONNECT_TIMEOUT,
        },
        listPerPage: process.env.LIST_PER_PAGE,
    },
    factory: {
        url: process.env.FACTORY_URL,
        apiKey: process.env.FACTORY_API_KEY,
    },
    adminData: {
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    }
};