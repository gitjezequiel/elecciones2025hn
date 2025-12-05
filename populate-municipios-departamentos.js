const pool = require('./db');
const fs = require('fs');
const path = require('path');

const populateMunicipiosDepartamentos = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        // 1. Read and parse Deptos.txt
        const deptosFilePath = path.join(__dirname, 'Deptos.txt');
        const deptosContent = fs.readFileSync(deptosFilePath, 'utf8');

        const lines = deptosContent.split('\n').filter(line => line.trim() !== '');
        const departments = [];

        for (let i = 1; i < lines.length; i++) { // Skip header
            const parts = lines[i].split('\t');
            if (parts.length >= 2) {
                departments.push({
                    id: parts[0].trim(),
                    nombre: parts[1].trim()
                });
            }
        }
        console.log('Departments loaded:', departments.length);

        // 2. Generate sample municipality data and insert
        const insertQuery = `
            INSERT INTO municipios_departamentos (dpto, municipioid, nombre)
            VALUES (?, ?, ?)
        `;

        for (const dept of departments) {
            // Generate 3 sample municipalities for each department
            for (let i = 1; i <= 3; i++) {
                const municipioid = `${dept.id}${String(i).padStart(2, '0')}`;
                const nombre = `${dept.nombre} - Municipio ${i}`;
                await connection.query(insertQuery, [dept.id, municipioid, nombre]);
            }
        }
        console.log('Sample municipalities populated successfully.');

    } catch (error) {
        console.error('Error populating municipios_departamentos table:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        pool.end();
    }
};

populateMunicipiosDepartamentos();
