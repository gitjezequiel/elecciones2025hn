const db = require('./db');

async function addEleccionesResultadosTable() {
  try {
    const connection = await db.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS elecciones_resultados (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_departamento VARCHAR(2) NOT NULL,
        id_municipio VARCHAR(3) NOT NULL,
        id_zona VARCHAR(2) NOT NULL,
        id_puesto VARCHAR(10) NOT NULL,
        id_mesa INT NOT NULL,
        parpo_id VARCHAR(10) NOT NULL,
        votos INT NOT NULL,
        votos_pdf INT DEFAULT 0,
        diferencia INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_resultado (id_departamento, id_municipio, id_zona, id_puesto, id_mesa, parpo_id)
      )
    `);
    console.log('Table "elecciones_resultados" created or already exists.');
    connection.release();
  } catch (error) {
    console.error('Error creating table "elecciones_resultados":', error);
    process.exit(1);
  }
}

addEleccionesResultadosTable().then(() => process.exit());
