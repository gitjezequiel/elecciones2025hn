const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { getHondurasTime } = require('../utils/time');

const syncDepartamentos = async (req, res) => {
    try {
        const deptsFilePath = path.join(__dirname, '../Deptos.txt');
        const deptsFileContent = fs.readFileSync(deptsFilePath, 'utf-8');
        
        const lines = deptsFileContent.split('\n').slice(1); // slice(1) to skip header
        let insertedCount = 0;
        let ignoredCount = 0;
        const hondurasTime = getHondurasTime();

        for (const line of lines) {
            if (line) {
                const [id, name] = line.split('\t');
                if (id && name) {
                    const id_departamento = id.trim();
                    const nombre_departamento = name.trim();
                    
                    // Use INSERT IGNORE to avoid errors on duplicate keys
                    const insertQuery = `
                        INSERT IGNORE INTO elecciones_departamentos (id_departamento, nombre_departamento, fecha_creacion)
                        VALUES (?, ?, ?);
                    `;
                    
                    const [result] = await pool.query(insertQuery, [id_departamento, nombre_departamento, hondurasTime]);
                    
                    if (result.affectedRows > 0) {
                        insertedCount++;
                    } else {
                        ignoredCount++;
                    }
                }
            }
        }

        res.status(200).json({
            message: 'Department synchronization completed.',
            inserted: insertedCount,
            ignored: ignoredCount
        });

    } catch (error) {
        console.error('Error synchronizing departments:', error);
        res.status(500).send('Error synchronizing departments.');
    }
};

module.exports = {
    syncDepartamentos,
};
