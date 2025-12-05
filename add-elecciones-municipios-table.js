const pool = require('./db');

const createEleccionesMunicipiosTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS elecciones_municipios (
                id_municipio INT AUTO_INCREMENT PRIMARY KEY,
                nombre_municipio VARCHAR(255) NOT NULL,
                dpto VARCHAR(10) NOT NULL,
                FOREIGN KEY (dpto) REFERENCES elecciones_departamentos(id_departamento)
            );
        `;

        await connection.query(createTableQuery);
        console.log('Table "elecciones_municipios" created or already exists.');

    } catch (error) {
        console.error('Error creating table "elecciones_municipios":', error);
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

createEleccionesMunicipiosTable();
