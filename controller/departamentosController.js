const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { getHondurasTime } = require('../utils/time');

const syncDepartamentos = async (req, res) => {
    // ... (existing syncDepartamentos function remains the same)
    try {
        const deptsFilePath = path.join(__dirname, '../Deptos.txt');
        const deptsFileContent = fs.readFileSync(deptsFilePath, 'utf-8');
        
        const lines = deptsFileContent.split('\n').slice(1);
        let insertedCount = 0;
        let ignoredCount = 0;
        const hondurasTime = getHondurasTime();

        for (const line of lines) {
            if (line) {
                const [id, name] = line.split('\t');
                if (id && name) {
                    const id_departamento = id.trim();
                    const nombre_departamento = name.trim();
                    console.log(`Processing department: ${nombre_departamento}`);
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

const getAllDepartamentos = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id_departamento, nombre_departamento FROM elecciones_departamentos ORDER BY nombre_departamento ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching all departments:', error);
        res.status(500).json({ message: 'Error fetching department data.' });
    }
};

module.exports = {
    syncDepartamentos,
    getAllDepartamentos
};