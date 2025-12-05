const pool = require('./db');

const createMunicipiosDepartamentosTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS municipios_departamentos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                dpto VARCHAR(10) NOT NULL,
                municipioid VARCHAR(10) NOT NULL,
                nombre VARCHAR(255) NOT NULL
            );
        `;

        await connection.query(createTableQuery);
        console.log('Table "municipios_departamentos" created or already exists.');

    } catch (error) {
        console.error('Error creating table "municipios_departamentos":', error);
    } finally {
        if (connection) {
            connection.release();
        }
        pool.end();
    }
};

createMunicipiosDepartamentosTable();
