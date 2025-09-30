const request = require('supertest');
const app = require('../src/service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

describe('authRouter tests', () => {
    let testUserAuthToken;

    beforeAll(async () => {
        testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
        const registerRes = await request(app).post('/api/auth').send(testUser);
        testUserAuthToken = registerRes.body.token;
        expectValidJwt(testUserAuthToken);
    });

    test('login', async () => {
        const loginRes = await request(app).put('/api/auth').send(testUser);
        expect(loginRes.status).toBe(200);
        expectValidJwt(loginRes.body.token);

        const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
        delete expectedUser.password;
        expect(loginRes.body.user).toMatchObject(expectedUser);
    });

    test('logout', async () => {
        const loginRes = await request(app).put('/api/auth').send(testUser);
        const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${loginRes.body.token}`).send(testUser);

        expect(logoutRes.status).toBe(200);
        expect(logoutRes.body.message).toBe('logout successful');
    })

    function expectValidJwt(potentialJwt) {
        expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
    }
})
