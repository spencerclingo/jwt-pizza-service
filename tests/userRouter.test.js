const request = require('supertest');
const app = require('../src/service');
const { DB } = require('../src/database/database.js');
const {Role} = require("../src/model/model");

const adminUser = {
    password: "password",
    name: "admin_full_name_unique",
    email: "email",
    roles: [{ role: Role.Admin }],
}

describe('userRouter tests', () => {
    let testUserAuthToken;
    let testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };


    beforeAll(async () => {
        testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
        const registerRes = await request(app).post('/api/auth').send(testUser);
        testUserAuthToken = registerRes.body.token;
        testUser = registerRes.body.user;
    });

    it('edit user', async () => {
        const newUser = { name: 'pizza diner 2', email: 'reg2@test.com' };
        const updatedUserRes = await request(app).put(`/api/user/${testUser.id}`).set('Authorization', `Bearer ${testUserAuthToken}`).send(newUser);
        const updatedUser = updatedUserRes.body.user;

        expect(updatedUser.email).toBe(newUser.email);
        expect(updatedUser.name).toBe(newUser.name);
        expect(updatedUser.roles[0].role).toBe(testUser.roles[0].role);

    });

    it('delete user', async () => {
        const user = await DB.addUser(adminUser);
        const loginRes = await request(app).put('/api/auth').send(user);

        const userListRes = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${loginRes.body.token}`).send();

        console.log(userListRes.body);
        expect(userListRes.status).toBe(200);
        expect(userListRes.body.users.map((user) => user.name)).not.toContain("admin_full_name_unique");
    })
})
