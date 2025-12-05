const pool = require('./db');

const alterTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        // It's safer to drop multiple columns in one statement if possible, but separate is fine.
        // We will also check if the columns exist before trying to drop them.
        const columnsToDrop = ['actas_pendientes', 'actas_totales', 'procesadas', 'actas_pendientes_anteriores', 'actas_pendientes_nuevas', 'diferencia_actas'];
        
        for (const column of columnsToDrop) {
            try {
                await connection.query(`ALTER TABLE elecciones_votos_updates DROP COLUMN ${column};`);
                console.log(`Successfully dropped column: ${column}`);
            } catch (error) {
                if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                    console.log(`Column ${column} likely already dropped.`);
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
