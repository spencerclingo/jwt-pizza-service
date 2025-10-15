const express = require('express');
const { asyncHandler } = require('../endpointHelper.js');
const { Role, DB } = require('../database/database.js');
const { authRouter, setAuth } = require('./authRouter.js');

const userRouter = express.Router();

userRouter.docs = [
    {
        method: 'GET',
        path: '/api/user/me',
        requiresAuth: true,
        description: 'Get authenticated user',
        example: `curl -X GET localhost:3000/api/user/me -H 'Authorization: Bearer tttttt'`,
        response: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] },
    },
    {
        method: 'PUT',
        path: '/api/user/:userId',
        requiresAuth: true,
        description: 'Update user',
        example: `curl -X PUT localhost:3000/api/user/1 -d '{"name":"常用名字", "email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
        response: { user: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] }, token: 'tttttt' },
    },
    {
        method: 'GET',
        path: '/api/user?page=0&limit=10&name=*',
        requiresAuth: true,
        description: 'Gets a list of users',
        example: `curl -X GET localhost:3000/api/user?page=0&limit=10&name=* -H 'Authorization: Bearer tttttt'`,
        response: {
            users: [
                {
                    id: 1,
                    name: '常用名字',
                    email: 'a@jwt.com',
                    roles: [{ role: 'admin' }],
                },
            ],
            more: false
        },
    },
    {
        method: 'DELETE',
        path: '/api/user/:userId',
        requiresAuth: true,
        description: 'Delete user',
        example: `curl -X GET localhost:3000/api/user/2 -H 'Authorization: Bearer tttttt'`,
        response: {
            users: [
                {
                    id: 1,
                    name: '常用名字',
                    email: 'a@jwt.com',
                    roles: [{ role: 'admin' }],
                },
            ],
            more: false
        },
    }
];

// getUser
userRouter.get(
  '/me',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  })
);

// updateUser
userRouter.put(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const userId = Number(req.params.userId);
    const user = req.user;
    if (user.id !== userId && !user.isRole(Role.Admin)) { // If userId matches passed in ID OR user is an admin
      return res.status(403).json({ message: 'unauthorized' });
    }

    const updatedUser = await DB.updateUser(userId, name, email, password);
    const auth = await setAuth(updatedUser);
    res.json({ user: updatedUser, token: auth });
  })
);

// getUserList
userRouter.get(
    '/',
    authRouter.authenticateToken,
    asyncHandler(async (req, res) => {
        if (!req.user.isRole(Role.Admin)) {
            return res.status(403).json({ message: 'unauthorized' });
        }
        const [users, more] = await DB.getUsers(req.query.page, req.query.limit, req.query.name);
        res.json({ users, more });
    })
);

// deleteUser
userRouter.delete(
    '/:userId',
    authRouter.authenticateToken,
    asyncHandler(async (req, res) => {
        if (!req.user.isRole(Role.Admin)) {
            return res.status(403).json({ message: 'unauthorized' });
        }
        await DB.deleteUser(req.params.userId);
        const [users, more] = await DB.getUsers();
        res.json({ users, more });
    })
)

// TODO: Add a middleware function somewhere to determine if someone has admin access to do admin things

module.exports = userRouter;
