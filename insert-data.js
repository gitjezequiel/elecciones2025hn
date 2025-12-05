const pool = require('./db');

const municipiosData = [
    { id_municipio: '000', dpto: '02', nombre_municipio: 'TODOS' },
    { id_municipio: '002', dpto: '02', nombre_municipio: 'BALFATE' },
    { id_municipio: '010', dpto: '02', nombre_municipio: 'BONITO ORIENTAL' },
    { id_municipio: '003', dpto: '02', nombre_municipio: 'IRIONA' },
    { id_municipio: '004', dpto: '02', nombre_municipio: 'LIMON' },
    { id_municipio: '005', dpto: '02', nombre_municipio: 'SABA' },
    { id_municipio: '006', dpto: '02', nombre_municipio: 'SANTA FE' },
    { id_municipio: '007', dpto: '02', nombre_municipio: 'SANTA ROSA AGUAN' },
    { id_municipio: '008', dpto: '02', nombre_municipio: 'SONAGUERA' },
    { id_municipio: '009', dpto: '02', nombre_municipio: 'TOCOA' },
    { id_municipio: '001', dpto: '02', nombre_municipio: 'TRUJILLO' }
];

const populateEleccionesMunicipios = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to the database.');

        for (const municipio of municipiosData) {
            const insertQuery = `
                INSERT IGNORE INTO elecciones_municipios (id_municipio, dpto, nombre_municipio)
                VALUES (?, ?, ?)
            `;
            await connection.query(insertQuery, [municipio.id_municipio, municipio.dpto, municipio.nombre_municipio]);
            console.log(`Inserted/Ignored: ${municipio.nombre_municipio}`);
        }

        console.log('Data insertion for elecciones_municipios completed.');

    } catch (error) {
        console.error('Error populating elecciones_municipios:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        pool.end();
    }
};

populateEleccionesMunicipios();
