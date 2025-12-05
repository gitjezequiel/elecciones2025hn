const pool = require('./db');

const createTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS api_responses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                departamento_nombre VARCHAR(255),
                departamento_codigo VARCHAR(10),
                response_data JSON
            );
        `;

        await connection.query(createTableQuery);
        console.log('Table "api_responses" created or already exists.');

    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        pool.end();
    }
};

createTable();
