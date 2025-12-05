const pool = require('./db');

const createDepartamentosTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS elecciones_departamentos (
                id_departamento VARCHAR(10) PRIMARY KEY,
                nombre_departamento VARCHAR(255) NOT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await connection.query(createTableQuery);
        console.log('Table "elecciones_departamentos" created or already exists.');

    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        pool.end();
    }
};

createDepartamentosTable();
