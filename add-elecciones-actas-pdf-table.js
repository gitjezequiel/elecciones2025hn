const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./elecciones.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS elecciones_actas_pdf (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_departamento TEXT,
    id_municipio TEXT,
    id_zona TEXT,
    id_puesto TEXT,
    nombre_archivo TEXT,
    url_archivo TEXT,
    ruta_archivo_local TEXT,
    UNIQUE(id_departamento, id_municipio, id_zona, id_puesto, nombre_archivo)
  )`, (err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Table elecciones_actas_pdf created or already exists.');
    }
  });
});

db.close();