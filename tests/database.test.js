const { DB } = require('../src/database/database.js');
const {Role} = require("../src/model/model");

const menuItem = {
    title: 'Test',
    description: 'Test description',
    image: "fake.png",
    price: 1,
}

const adminUser = {
    password: "password",
    name: "admin",
    email: "email",
    roles: [{ role: Role.Admin }],
}

const franchiseeUser = {
    password: "password",
    name: "franchisee",
    email: "email",
    roles: [{ role: Role.Franchisee }],
}

describe('Database Tests', function() {
    let connection;
    let db = DB;
    beforeEach(async () => {
        await db.initialized;
        connection = await db.getConnection();
        await connection.query('SET autocommit = 0');
        await connection.beginTransaction();
    });

    afterEach(async () => {
        await connection.rollback();
        await connection.end();
    });

    it('getMenu with no menu', async function() {
        const menu = await db.getMenu(connection);
        expect(menu.length).toBe(0);
    })

    it('addMenuItem only once', async function() {
        const pizza = await db.addMenuItem(menuItem, connection);

        expect(pizza.title).toBe(menuItem.title);
        expect(pizza.price).toBe(menuItem.price);
        expect(pizza.image).toBe(menuItem.image);
        expect(pizza.description).toBe(menuItem.description);
    })

    it('getMenu with one item', async function() {
        await db.addMenuItem(menuItem, connection);
        const menu = await db.getMenu(connection);

        expect(menu.length).toBe(1);
        expect(menu[0].title).toBe(menuItem.title);
        expect(menu[0].description).toBe(menuItem.description);
        expect(menu[0].image).toBe(menuItem.image);
        expect(menu[0].price).toBe(menuItem.price);
    })

    it('add admin user', async function() {
        const user = await db.addUser(adminUser, connection);

        expect(user.name).toBe(adminUser.name);
        expect(user.email).toBe(adminUser.email);
        expect(user.password).toBe(undefined);
    })

    it('add franchisee user without creating franchise', async function() {
        await expect(db.addUser(franchiseeUser, connection)).rejects.toThrow('No ID found');
    })

    it('getUser with bad email', async function() {
        await expect(db.getUser("bad_email", "password", connection)).rejects.toThrow('unknown user');
    })

    it('getUser with bad password', async function() {
        await db.addUser(adminUser, connection);
        await expect(db.getUser(adminUser.email, "bad_password", connection)).rejects.toThrow('unknown user');
    })

    it('getUser with good information', async function() {
        await db.addUser(adminUser, connection);
        const user = await db.getUser(adminUser.email, adminUser.password, connection);

        expect(user.name).toBe(adminUser.name);
        expect(user.email).toBe(adminUser.email);
        expect(user.password).toBe(undefined);
        expect(user.roles[0].role).toBe(Role.Admin);
    })

    it('updateUser with bad information', async function() {
        await expect(db.updateUser(99, adminUser.name, "bad_email", adminUser.password, connection)).rejects.toThrow('unknown user');
    })

    it('test if a non-existent user is logged in', async function() {
        const isFound = await db.isLoggedIn("made_up_token", connection);
        expect(isFound).toBe(false);
    })

    it('log out a user', async function() {
        await db.loginUser(1, "this_token", connection);
        let isFound = await db.isLoggedIn("this_token", connection);
        expect(isFound).toBe(true);

        await db.logoutUser("this_token", connection);
        isFound = await db.isLoggedIn("this_token", connection);
        expect(isFound).toBe(false);
    })
})