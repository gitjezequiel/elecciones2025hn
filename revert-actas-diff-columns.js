const pool = require('./db');

const alterTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const queries = [
            `ALTER TABLE elecciones_votos_updates DROP COLUMN actas_pendientes_anteriores;`,
            `ALTER TABLE elecciones_votos_updates DROP COLUMN actas_pendientes_nuevas;`,
            `ALTER TABLE elecciones_votos_updates DROP COLUMN diferencia_actas;`
        ];

        for (const query of queries) {
            try {
                await connection.query(query);
                console.log(`Successfully executed: ${query}`);
            } catch (error) {
                // Ignore "column doesn't exist" errors if the script is run more than once
                if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                    console.log(`Column likely already dropped: ${query}`);
                } else {
                    throw error;
                }
            }
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
