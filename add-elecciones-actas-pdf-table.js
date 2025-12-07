const db = require('./db');

async function addEleccionesActasPdfTable() {
  try {
    const connection = await db.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS elecciones_actas_pdf (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_departamento VARCHAR(2) NOT NULL,
        id_municipio VARCHAR(3) NOT NULL,
        id_zona VARCHAR(2) NOT NULL,
        id_puesto VARCHAR(10) NOT NULL,
        id_mesa INT NOT NULL,
        id_partido VARCHAR(10) NOT NULL,
        votos_pdf INT DEFAULT NULL,
        votos_sitio INT DEFAULT NULL,
        diferencia_entre_sitio INT DEFAULT NULL,
        votos_en_letras VARCHAR(255) DEFAULT NULL,
        inconsistencia_letras_numeros BOOLEAN DEFAULT FALSE,
        pdf_url VARCHAR(1024) DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_acta_partido (id_departamento, id_municipio, id_zona, id_puesto, id_mesa, id_partido)
      )
    `);
    console.log('Table "elecciones_actas_pdf" created or already exists.');
    connection.release();
  } catch (error) {
    console.error('Error creating table "elecciones_actas_pdf":', error);
    process.exit(1);
  }
}

addEleccionesActasPdfTable().then(() => process.exit());
