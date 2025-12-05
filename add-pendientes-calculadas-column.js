const pool = require('./db');

const alterTable = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        const query = `ALTER TABLE elecciones_votos_updates ADD COLUMN pendientes_calculadas INT DEFAULT 0;`;

        await connection.query(query);
        console.log(`Successfully executed: ${query}`);
        
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
