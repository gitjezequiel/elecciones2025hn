const db = require('./db');

async function addEleccionesMesasTable() {
  try {
    const connection = await db.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS elecciones_mesas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_departamento VARCHAR(2) NOT NULL,
        id_municipio VARCHAR(3) NOT NULL,
        id_zona VARCHAR(2) NOT NULL,
        id_puesto VARCHAR(10) NOT NULL,
        id_mesa INT NOT NULL,
        publicada INT,
        escrutado BOOLEAN,
        digitalizado INT,
        id_informacion_mesa_corporacion VARCHAR(50),
        nombre_archivo VARCHAR(255),
        etiquetas TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_mesa (id_departamento, id_municipio, id_zona, id_puesto, id_mesa)
      )
    `);
    console.log('Table "elecciones_mesas" created or already exists.');
    connection.release();
  } catch (error) {
    console.error('Error creating table "elecciones_mesas":', error);
    process.exit(1);
  }
}

addEleccionesMesasTable().then(() => process.exit());
