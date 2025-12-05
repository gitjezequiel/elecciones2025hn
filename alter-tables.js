const pool = require('./db');

const alterTables = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const queries = [
            `ALTER TABLE api_responses MODIFY COLUMN created_at DATETIME DEFAULT NULL;`,
            `ALTER TABLE elecciones_candidatos MODIFY COLUMN fecha_creacion DATETIME DEFAULT NULL;`,
            `ALTER TABLE elecciones_departamentos MODIFY COLUMN fecha_creacion DATETIME DEFAULT NULL;`,
            `ALTER TABLE elecciones_votos_updates MODIFY COLUMN fecha_actualizacion DATETIME DEFAULT NULL;`
        ];

        for (const query of queries) {
            await connection.query(query);
            console.log(`Successfully executed: ${query}`);
        }

        console.log('Finished altering tables.');

    } catch (error) {
        console.error('An error occurred during table alteration:', error);
        console.log('This might be okay if the columns were already altered. Check the error message.');
    } finally {
        if (connection) {
            connection.release();
        }
        pool.end();
    }
};

alterTables();
