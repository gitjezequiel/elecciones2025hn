const db = require('./db');

async function addEleccionesZonasTable() {
  try {
    const connection = await db.getConnection();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS elecciones_zonas (
        id_zona VARCHAR(2) PRIMARY KEY,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Table "elecciones_zonas" created or already exists.');

    // Check if '01' exists, if not, insert
    const [zone01] = await connection.query("SELECT * FROM elecciones_zonas WHERE id_zona = '01'");
    if (zone01.length === 0) {
      await connection.query("INSERT INTO elecciones_zonas (id_zona) VALUES ('01')");
      console.log("Inserted '01' into elecciones_zonas.");
    }

    // Check if '02' exists, if not, insert
    const [zone02] = await connection.query("SELECT * FROM elecciones_zonas WHERE id_zona = '02'");
    if (zone02.length === 0) {
      await connection.query("INSERT INTO elecciones_zonas (id_zona) VALUES ('02')");
      console.log("Inserted '02' into elecciones_zonas.");
    }
    
    connection.release();
    console.log('Default zones "01" and "02" ensured in elecciones_zonas table.');
  } catch (error) {
    console.error('Error managing table "elecciones_zonas":', error);
    process.exit(1);
  }
}

addEleccionesZonasTable().then(() => process.exit());
