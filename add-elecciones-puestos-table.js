const db = require('./db');

async function addEleccionesPuestosTable() {
  try {
    const connection = await db.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS elecciones_puestos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_departamento VARCHAR(2) NOT NULL,
        id_municipio VARCHAR(3) NOT NULL,
        id_zona VARCHAR(2) NOT NULL,
        id_puesto VARCHAR(10) NOT NULL,
        nombre_puesto VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_puesto (id_departamento, id_municipio, id_zona, id_puesto)
      )
    `);
    // Add id_zona column if it doesn't exist
    const [columns] = await connection.query("SHOW COLUMNS FROM elecciones_puestos LIKE 'id_zona'");
    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE elecciones_puestos
        ADD COLUMN id_zona VARCHAR(2) NOT NULL DEFAULT '00' AFTER id_municipio;
      `);
      console.log('Added id_zona column to elecciones_puestos table.');
    }

    // Drop and re-add unique key to include id_zona
    const [constraints] = await connection.query("SHOW INDEX FROM elecciones_puestos WHERE Key_name = 'unique_puesto'");
    if (constraints.length > 0) {
      await connection.query("ALTER TABLE elecciones_puestos DROP INDEX unique_puesto");
      console.log('Dropped old unique_puesto index.');
    }
    await connection.query(`
      ALTER TABLE elecciones_puestos
      ADD UNIQUE KEY unique_puesto (id_departamento, id_municipio, id_zona, id_puesto);
    `);
    console.log('Updated unique_puesto index to include id_zona.');

    console.log('Table "elecciones_puestos" structure checked/updated.');
    connection.release();
  } catch (error) {
    console.error('Error updating table "elecciones_puestos":', error);
    process.exit(1);
  }
}

addEleccionesPuestosTable().then(() => process.exit());
