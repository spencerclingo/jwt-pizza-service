const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const config = require('../config.js');
const { StatusCodeError } = require('../endpointHelper.js');
const { Role } = require('../model/model.js');
const dbModel = require('./dbModel.js');

let dbName = config.db.connection.database;

class DB {
  constructor() {
    this.initialized = this.initializeDatabase();
  }

  async getMenu(connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      const rows = await this.query(connection, `SELECT * FROM menu`);
      return rows;
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async addMenuItem(item, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      const addResult = await this.query(connection, `INSERT INTO menu (title, description, image, price) VALUES (?, ?, ?, ?)`, [item.title, item.description, item.image, item.price]);
      return { ...item, id: addResult.insertId };
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async addUser(user, connection = null) {
    const defaultConnection = connection == null;
    if (defaultConnection) connection = await this.getConnection(connection);
    try {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const userResult = await this.query(connection, `INSERT INTO user (name, email, password) VALUES (?, ?, ?)`, [user.name, user.email, hashedPassword]);
      const userId = userResult.insertId;
      for (const role of user.roles) {
        switch (role.role) {
          case Role.Franchisee: {
            const franchiseId = await this.getID(connection, 'name', Role.Franchisee, 'franchise');
            await this.query(connection, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [userId, role.role, franchiseId]);
            break;
          }
          default: {
            await this.query(connection, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [userId, role.role, 0]);
            break;
          }
        }
      }
      return { ...user, id: userId, password: undefined };
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async getUser(email, password, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      const userResult = await this.query(connection, `SELECT * FROM user WHERE email=?`, [email]);
      const user = userResult[0];
      if (!user || (password && !(await bcrypt.compare(password, user.password)))) {
        throw new StatusCodeError('unknown user', 404);
      }

      const roleResult = await this.query(connection, `SELECT * FROM userRole WHERE userId=?`, [user.id]);
      const roles = roleResult.map((r) => {
        return { objectId: r.objectId ?? undefined, role: r.role };
      });

      return { ...user, roles: roles, password: undefined };
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async updateUser(userId, name, email, password, connection = null) {
    // TODO: This function is extremely insecure on its own because if you can guess someone's userID,
    //  you can change all of their information.
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      const params = [];
      const values = []
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        params.push(`password=?`);
        values.push(hashedPassword)
      }
      if (email) {
        params.push(`email=?`);
        values.push(email);
      }
      if (name) {
        params.push(`name=?`);
        values.push(name);
      }
      values.push(userId);
      if (params.length > 0) {
        // This line was susceptible to SQL injection by setting userId = "1 OR 1=1" to update all users
        await this.query(connection, `UPDATE user SET ${params.join(', ')} WHERE id=?`, values);
      }
      return this.getUser(email, password); // Don't pass a connection because this queries instead of updates
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async loginUser(userId, token, connection = null) {
    token = this.getTokenSignature(token);
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      await this.query(connection, `INSERT INTO auth (token, userId) VALUES (?, ?) ON DUPLICATE KEY UPDATE token=token`, [token, userId]);
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async isLoggedIn(token, connection = null) {
    token = this.getTokenSignature(token);
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      const authResult = await this.query(connection, `SELECT userId FROM auth WHERE token=?`, [token]);
      return authResult.length > 0;
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async logoutUser(token, connection = null) {
    token = this.getTokenSignature(token);
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      await this.query(connection, `DELETE FROM auth WHERE token=?`, [token]);
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async getOrders(user, page = 1, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      const offset = this.getOffset(page, config.db.listPerPage);
      const orders = await this.query(connection, `SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT ${offset},${config.db.listPerPage}`, [user.id]);
      for (const order of orders) {
        let items = await this.query(connection, `SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`, [order.id]);
        order.items = items;
      }
      return { dinerId: user.id, orders: orders, page };
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async addDinerOrder(user, order, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      const orderResult = await this.query(connection, `INSERT INTO dinerOrder (dinerId, franchiseId, storeId, date) VALUES (?, ?, ?, now())`, [user.id, order.franchiseId, order.storeId]);
      const orderId = orderResult.insertId;
      for (const item of order.items) {
        const menuId = await this.getID(connection, 'id', item.menuId, 'menu');
        await this.query(connection, `INSERT INTO orderItem (orderId, menuId, description, price) VALUES (?, ?, ?, ?)`, [orderId, menuId, item.description, item.price]);
      }
      return { ...order, id: orderId };
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async createFranchise(franchise, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      for (const admin of franchise.admins) {
        const adminUser = await this.query(connection, `SELECT id, name FROM user WHERE email=?`, [admin.email]);
        if (adminUser.length == 0) {
          throw new StatusCodeError(`unknown user for franchise admin ${admin.email} provided`, 404);
        }
        admin.id = adminUser[0].id;
        admin.name = adminUser[0].name;
      }

      const franchiseResult = await this.query(connection, `INSERT INTO franchise (name) VALUES (?)`, [franchise.name]);
      franchise.id = franchiseResult.insertId;

      for (const admin of franchise.admins) {
        await this.query(connection, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [admin.id, Role.Franchisee, franchise.id]);
      }

      return franchise;
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async deleteFranchise(franchiseId, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      await connection.beginTransaction();
      try {
        await this.query(connection, `DELETE FROM store WHERE franchiseId=?`, [franchiseId]);
        await this.query(connection, `DELETE FROM userRole WHERE objectId=?`, [franchiseId]);
        await this.query(connection, `DELETE FROM franchise WHERE id=?`, [franchiseId]);
        await connection.commit();
      } catch {
        await connection.rollback();
        throw new StatusCodeError('unable to delete franchise', 500);
      }
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async getFranchises(authUser, page = 0, limit = 10, nameFilter = '*', connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);

    const offset = page * limit;
    nameFilter = nameFilter.replace(/\*/g, '%');

    try {
      // /api/franchise?limit=0%3B%20SET%20FOREIGN_KEY_CHECKS%3D0%3B%20DROP%20TABLE%20IF%20EXISTS%20users%3B%20DROP%20TABLE%20IF%20EXISTS%20franchise%3B%20DROP%20TABLE%20IF%20EXISTS%20userrole%3B%20--
      // will SQL inject and drop the users, franchise, userrole table on the original query without the parsing
      const integerLimit = parseInt(limit, 10) + 1;
      const integerOffset = parseInt(offset, 10);
      let franchises = await this.query(connection, `SELECT id, name FROM franchise WHERE name LIKE ? LIMIT ${integerLimit} OFFSET ${integerOffset}`, [nameFilter]);

      const more = franchises.length > limit;
      if (more) {
        franchises = franchises.slice(0, limit);
      }

      for (const franchise of franchises) {
        if (authUser?.isRole(Role.Admin)) {
          // I don't understand the purpose of this function call
          await this.getFranchise(franchise);
        } else {
          franchise.stores = await this.query(connection, `SELECT id, name FROM store WHERE franchiseId=?`, [franchise.id]);
        }
      }
      return [franchises, more];
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async getUsers(page = 0, limit = 10, nameFilter = '*', connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);

    const offset = page * limit;
    nameFilter = nameFilter.replace(/\*/g, '%');

    try {
      const integerLimit = parseInt(limit, 10) + 1;
      const integerOffset = parseInt(offset, 10);
      let users = await this.query(connection, `
            SELECT user.id, user.name, user.email, GROUP_CONCAT(userrole.role SEPARATOR ', ') AS roles 
            FROM user
            JOIN userrole ON userrole.userId = user.id
            WHERE user.name LIKE ?
            GROUP BY user.id, user.name, user.email
            LIMIT ${integerLimit} OFFSET ${integerOffset}`,
          [nameFilter]);

      const more = users.length > limit;
      if (more) {
        users = users.slice(0, limit);
      }
      return [users, more];
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async getUserFranchises(userId, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      let franchiseIds = await this.query(connection, `SELECT objectId FROM userRole WHERE role='franchisee' AND userId=?`, [userId]);
      if (franchiseIds.length === 0) {
        return [];
      }

      franchiseIds = franchiseIds.map((v) => v.objectId);
      const franchises = await this.query(connection, `SELECT id, name FROM franchise WHERE id in (${franchiseIds.join(',')})`);
      for (const franchise of franchises) {
        // I don't understand the purpose of this function call
        await this.getFranchise(franchise);
      }
      return franchises;
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async getFranchise(franchise, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      franchise.admins = await this.query(connection, `SELECT u.id, u.name, u.email FROM userRole AS ur JOIN user AS u ON u.id=ur.userId WHERE ur.objectId=? AND ur.role='franchisee'`, [franchise.id]);

      franchise.stores = await this.query(connection, `SELECT s.id, s.name, COALESCE(SUM(oi.price), 0) AS totalRevenue FROM dinerOrder AS do JOIN orderItem AS oi ON do.id=oi.orderId RIGHT JOIN store AS s ON s.id=do.storeId WHERE s.franchiseId=? GROUP BY s.id`, [franchise.id]);

      return franchise;
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async createStore(franchiseId, store, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      const insertResult = await this.query(connection, `INSERT INTO store (franchiseId, name) VALUES (?, ?)`, [franchiseId, store.name]);
      return { id: insertResult.insertId, franchiseId, name: store.name };
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async deleteStore(franchiseId, storeId, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      await this.query(connection, `DELETE FROM store WHERE franchiseId=? AND id=?`, [franchiseId, storeId]);
    } finally {
      if (defaultConnection) connection.end();
    }
  }

  async deleteUser(userId, connection = null) {
    const defaultConnection = connection == null;
    connection = await this.getConnection(connection);
    try {
      await this.query(connection, `DELETE FROM user WHERE id=?`, [userId]);
    } finally {
      if (defaultConnection) connection.end();
    }
  }


  getOffset(currentPage = 1, listPerPage) {
    return (currentPage - 1) * [listPerPage];
  }

  getTokenSignature(token) {
    const parts = token.split('.');
    if (parts.length > 2) {
      return parts[2];
    }
    return '';
  }

  async query(connection, sql, params) {
    const [results] = await connection.execute(sql, params);
    return results;
  }

  async getID(connection, key, value, table) {
    const [rows] = await connection.execute(`SELECT id FROM ${table} WHERE ${key}=?`, [value]);
    if (rows.length > 0) {
      return rows[0].id;
    }
    throw new Error('No ID found');
  }

  async getConnection(connection = null) {
    // Make sure the database is initialized before trying to get a connection.
    await this.initialized;
    return this._getConnection(connection);
  }

  async _getConnection(connection = null, setUse = true) {
    if (connection == null) {
      connection = await mysql.createConnection({
        host: config.db.connection.host,
        user: config.db.connection.user,
        password: config.db.connection.password,
        connectTimeout: config.db.connection.connectTimeout,
        decimalNumbers: true,
      });
    }
    if (setUse) {
      await connection.query(`USE ${dbName}`);
    }
    return connection;
  }

  async initializeDatabase() {
    try {
      const connection = await this._getConnection(null, false);
      try {
        const dbExists = await this.checkDatabaseExists(connection);
        console.log(dbExists ? 'Database exists' : 'Database does not exist, creating it');

        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        await connection.query(`USE ${dbName}`);

        if (!dbExists) {
          console.log('Successfully created database');
        }

        for (const statement of dbModel.tableCreateStatements) {
          await connection.query(statement);
        }

        if (!dbExists) {
          const path = require("path");
          const {exec} = require("node:child_process");

          const defaultAdmin = { name: config.adminData.name, email: config.adminData.email, password: config.adminData.password, roles: [{ role: Role.Admin }] };
          await this.addUser(defaultAdmin, connection);

          // This finds the script's absolute path from the location of the current file
          const scriptPath = path.join(__dirname, '../../scripts', 'generatePizzaData.sh');
          const normalizedPath = scriptPath
              .replace(/\\/g, '/')
              .replace(/^C:/, '/c');

          await exec(`chmod +x ${normalizedPath}`, (err, output) => {
            if (err && process.env.NODE_ENV !== 'test') {
              console.error("could not execute command: ", err)
              return
            }
            console.log("Output: \n", output)
          })

          await exec(`bash ${normalizedPath} localhost:3000`, (err, stdout, stderr) => {
            if (err && process.env.NODE_ENV !== 'test') {
              console.error(`Script failed with exit code ${err.code}`);
              console.error(`stdout: ${stdout}`);
              console.error(`stderr: ${stderr}`);
              return;
            }
            console.log(`Script output: ${stdout}`);
          });
        }
      } finally {
        connection.end();
      }
    } catch (err) {
      console.error(JSON.stringify({ message: 'Error initializing database', exception: err.message, connection: config.db.connection }));
    }
  }

  async checkDatabaseExists(connection) {
    const [rows] = await connection.execute(`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`, [dbName]);
    return rows.length > 0;
  }
}

const db = new DB();
module.exports = { Role, DB: db };
