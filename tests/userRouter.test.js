const request = require('supertest');
const app = require('../src/service');

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

    })
})
