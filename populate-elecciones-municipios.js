const pool = require('./db');

const municipiosData = [
    { id_municipio: '000', dpto: '01', nombre_municipio: 'TODOS' },
    { id_municipio: '008', dpto: '01', nombre_municipio: 'ARIZONA' },
    { id_municipio: '002', dpto: '01', nombre_municipio: 'EL PORVENIR' },
    { id_municipio: '003', dpto: '01', nombre_municipio: 'ESPARTA' },
    { id_municipio: '004', dpto: '01', nombre_municipio: 'JUTIAPA' },
    { id_municipio: '001', dpto: '01', nombre_municipio: 'LA CEIBA' },
    { id_municipio: '005', dpto: '01', nombre_municipio: 'LA MASICA' },
    { id_municipio: '006', dpto: '01', nombre_municipio: 'SAN FRANCISCO' },
    { id_municipio: '007', dpto: '01', nombre_municipio: 'TELA' },
    { id_municipio: '000', dpto: '06', nombre_municipio: 'TODOS' },
    { id_municipio: '002', dpto: '06', nombre_municipio: 'APACILAGUA' },
    { id_municipio: '001', dpto: '06', nombre_municipio: 'CHOLUTECA' },
    { id_municipio: '003', dpto: '06', nombre_municipio: 'CONCEPCION DE MARIA' },
    { id_municipio: '004', dpto: '06', nombre_municipio: 'DUYURE' },
    { id_municipio: '005', dpto: '06', nombre_municipio: 'EL CORPUS' },
    { id_municipio: '006', dpto: '06', nombre_municipio: 'EL TRIUNFO' },
    { id_municipio: '007', dpto: '06', nombre_municipio: 'MARCOVIA' },
    { id_municipio: '008', dpto: '06', nombre_municipio: 'MOROLICA' },
    { id_municipio: '009', dpto: '06', nombre_municipio: 'NAMASIGUE' },
    { id_municipio: '010', dpto: '06', nombre_municipio: 'OROCUINA' },
    { id_municipio: '011', dpto: '06', nombre_municipio: 'PESPIRE' },
    { id_municipio: '012', dpto: '06', nombre_municipio: 'SAN ANTONIO DE FLORES' },
    { id_municipio: '013', dpto: '06', nombre_municipio: 'SAN ISIDRO' },
    { id_municipio: '014', dpto: '06', nombre_municipio: 'SAN JOSE' },
    { id_municipio: '015', dpto: '06', nombre_municipio: 'SAN MARCOS DE COLON' },
    { id_municipio: '016', dpto: '06', nombre_municipio: 'SANTA ANA DE YUSGUARE' },
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
