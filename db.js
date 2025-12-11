require('dotenv').config();
const mysql = require('mysql2/promise');

// Use environment variables for database configuration
const dbConfig = {
    host: process.env.DB_HOST || '34.174.64.218',
    user: process.env.DB_USER || 'uefdglongqgvo',
    password: process.env.DB_PASSWORD || 'Axalon2025#..',
    database: process.env.DB_DATABASE || 'dbqygl8bcsfkjh'
};

const pool = mysql.createPool(dbConfig);

module.exports = pool;
