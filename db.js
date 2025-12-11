require('dotenv').config();
const mysql = require('mysql2/promise');

// Use environment variables for database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'asdasd',
    user: process.env.DB_USER || 'asdasdasd',
    password: process.env.DB_PASSWORD || 'asdasdasd',
    database: process.env.DB_DATABASE || 'asdasdasdas'
};

const pool = mysql.createPool(dbConfig);

module.exports = pool;
