const mysql = require('mysql2/promise');

// WARNING: Hardcoding credentials is a security risk.
// It is recommended to use environment variables or a secret management system.
const dbConfig = {
    host: '34.174.64.218',
    user: 'uefdglongqgvo',
    password: 'Axalon2025#..',
    database: 'dbqygl8bcsfkjh'
};

const pool = mysql.createPool(dbConfig);

module.exports = pool;
