const pool = require('./db');

const alterTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const columns = {
            actas_pendientes: 'INT DEFAULT 0',
            actas_totales: 'INT DEFAULT 0',
            procesadas: 'INT DEFAULT 0',
            actas_pendientes_anteriores: 'INT DEFAULT 0',
            actas_pendientes_nuevas: 'INT DEFAULT 0',
            diferencia_actas: 'INT DEFAULT 0'
        };

        for (const [column, definition] of Object.entries(columns)) {
            try {
                await connection.query(`ALTER TABLE elecciones_votos_updates ADD COLUMN ${column} ${definition};`);
                console.log(`Successfully added column: ${column}`);
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Column ${column} already exists.`);
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
