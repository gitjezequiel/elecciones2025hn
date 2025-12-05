const pool = require('./db');

const createVotosUpdatesTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS elecciones_votos_updates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                candidato_codigo VARCHAR(10) NOT NULL,
                departamento_codigo VARCHAR(2) NOT NULL,
                partido_id VARCHAR(4) NOT NULL,
                votos_anteriores INT NOT NULL,
                votos_nuevos INT NOT NULL,
                diferencia INT NOT NULL,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await connection.query(createTableQuery);
        console.log('Table "elecciones_votos_updates" created or already exists.');

    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        pool.end();
    }
};

createVotosUpdatesTable();
