const config = require("../src/config");

const request = require('supertest');
const app = require('../src/service');

describe('franchiseRouter tests', () => {
    console.log(config)
    let testUserAuthToken;
    let testUser = { name: 'pizza franchise', email: 'franchise@test.com', password: 'a' };
    let defaultFranchise = { admins: [{ email: config.adminData.email, name: config.adminData.name }], name: 'pizza franchise'};

    beforeAll(async () => {
        const registerRes = await request(app).post('/api/auth').send(testUser);
        testUserAuthToken = registerRes.body.token;
        testUser = registerRes.body.user;
    });

    beforeEach(async () => {
        testUser.email = Math.random().toString(36).substring(2, 6) + testUser.email;
        defaultFranchise.name = Math.random().toString(36).substring(2, 9) + " " + defaultFranchise.name;
    })

    it('getUserFranchises', async () => {
        const res = await request(app).get(`/api/franchise/${testUser.id}`).set('Authorization', `Bearer ${testUserAuthToken}`).send();

        expect(res.body).toEqual([]);
    })

    it('createFranchise', async () => {
        const getFranchiseRes = await request(app).get(`/api/franchise`);
        const numFranchises = getFranchiseRes.body.franchises.length;

        let adminUser = { email: config.adminData.email, password: config.adminData.password };
        const adminUserRes = await request(app).put(`/api/auth/`).send(adminUser);
        let adminUserAuthToken = adminUserRes.body.token;

        const res = await request(app).post(`/api/franchise/`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(defaultFranchise);

        delete res.body.admins[0].id;

        expect(res.body.admins).toEqual(defaultFranchise.admins);
        expect(res.body.name).toBe(defaultFranchise.name);

        await request(app).delete(`/api/franchise/${res.body.id}`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(adminUser);
    })

    it('deleteFranchise', async () => {
        let adminUser = { email: config.adminData.email, password: config.adminData.password };
        const adminUserRes = await request(app).put(`/api/auth/`).send(adminUser);
        let adminUserAuthToken = adminUserRes.body.token;

        // Create a franchise and get all franchises
        const res = await request(app).post(`/api/franchise/`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(defaultFranchise);
        const getResponse = await request(app).get(`/api/franchise`);

        // Delete the franchise and get all franchises
        const deleteFranchiseRes = await request(app).delete(`/api/franchise/${res.body.id}`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(adminUser);
        const getResponse2 = await request(app).get(`/api/franchise`);

        // Assert there are fewer franchises after deletion
        expect(deleteFranchiseRes.body.message).toBe('franchise deleted');
        expect(getResponse2.body.franchises.length).toBeLessThan(getResponse.body.franchises.length);
    })

    it('createStore', async () => {
        let adminUser = { email: config.adminData.email, password: config.adminData.password };
        const adminUserRes = await request(app).put(`/api/auth/`).send(adminUser);
        let adminUserAuthToken = adminUserRes.body.token;
        const createFranchiseResponse = await request(app).post(`/api/franchise/`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(defaultFranchise);
        const franchiseId = createFranchiseResponse.body.id;

        // Create a store in the franchise
        const store = {name: "storeName"}
        const createStoreResponse = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(store);

        expect(createStoreResponse.body.name).toBe("storeName");
        expect(createStoreResponse.body.franchiseId).toBe(franchiseId);
    })

    it('createStore', async () => {
        let adminUser = { email: config.adminData.email, password: config.adminData.password };
        const adminUserRes = await request(app).put(`/api/auth/`).send(adminUser);
        let adminUserAuthToken = adminUserRes.body.token;
        const createFranchiseResponse = await request(app).post(`/api/franchise/`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(defaultFranchise);
        const franchiseId = createFranchiseResponse.body.id;
        const store = {name: "storeName"}
        const createStoreResponse = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(store);

        // Delete Store
        const deleteStoreResponse = await request(app).delete(`/api/franchise/${franchiseId}/store/${createStoreResponse.body.id}`).set('Authorization', `Bearer ${adminUserAuthToken}`).send();
        expect(deleteStoreResponse.body.message).toBe('store deleted');
    })
})
