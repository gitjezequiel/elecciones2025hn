// Standalone script to sync departments from Deptos.txt to the database.

const fs = require('fs');
const path = require('path');
const pool = require('./db');
const { getHondurasTime } = require('./utils/time');

const runSync = async () => {
    console.log('Starting department synchronization...');
    let connection;
    try {
        connection = await pool.getConnection();
        const hondurasTime = getHondurasTime();

        const deptsFilePath = path.join(__dirname, './Deptos.txt');
        const deptsFileContent = fs.readFileSync(deptsFilePath, 'utf-8');
        
        const lines = deptsFileContent.split('\n').slice(1); // slice(1) to skip header
        let insertedCount = 0;
        let ignoredCount = 0;

        for (const line of lines) {
            if (line) {
                const [id, name] = line.split('\t');
                if (id && name) {
                    const id_departamento = id.trim();
                    const nombre_departamento = name.trim();
                    
                    const insertQuery = `
                        INSERT IGNORE INTO elecciones_departamentos (id_departamento, nombre_departamento, fecha_creacion)
                        VALUES (?, ?, ?);
                    `;
                    
                    const [result] = await connection.query(insertQuery, [id_departamento, nombre_departamento, hondurasTime]);
                    
                    if (result.affectedRows > 0) {
                        insertedCount++;
                    } else {
                        ignoredCount++;
                    }
                }
            }
        }

        console.log('Department synchronization completed.');
        console.log(`- Inserted: ${insertedCount} new departments`);
        console.log(`- Ignored: ${ignoredCount} existing departments`);

    } catch (error) {
        console.error('An error occurred during department synchronization:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        // End the pool so the script can exit
        pool.end();
    }
};

runSync();
