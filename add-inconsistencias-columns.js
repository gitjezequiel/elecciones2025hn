const pool = require('./db');

const alterTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const queries = [
            `ALTER TABLE elecciones_votos_updates ADD COLUMN inconsistencias_anteriores INT DEFAULT 0;`,
            `ALTER TABLE elecciones_votos_updates ADD COLUMN inconsistencias_actuales INT DEFAULT 0;`,
            `ALTER TABLE elecciones_votos_updates ADD COLUMN diferencia_de_inconsistencias INT DEFAULT 0;`
        ];

        for (const query of queries) {
            await connection.query(query);
            console.log(`Successfully executed: ${query}`);
        }

        console.log('Finished altering table elecciones_votos_updates.');

    } catch (error) {
        console.error('An error occurred during table alteration:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        pool.end();
    }
};

alterTable();
