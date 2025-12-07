const db = require('../db');
const axios = require('axios');

const syncPuestos = async (req, res) => {
  try {
    const [departamentos] = await db.query('SELECT id_departamento FROM elecciones_departamentos');
    
    for (const depto of departamentos) {
      const { id_departamento } = depto;
      const [municipios] = await db.query('SELECT id_municipio FROM elecciones_municipios WHERE dpto = ?', [id_departamento]);

      for (const muni of municipios) {
        const { id_municipio } = muni;

        // Fetch zones from elecciones_zonas table
        const [zonas] = await db.query('SELECT id_zona FROM elecciones_zonas');

        for (const zona of zonas) {
          const { id_zona } = zona;
          const url = `https://resultadosgenerales2025-api.cne.hn/esc/v1/actas-documentos/01/${id_departamento}/${id_municipio}/${id_zona}/puestos`;
          
          try {
            console.log(`Fetching puestos from: ${url}`);
            const response = await axios.get(url);
            const puestos = response.data;

            if (puestos && puestos.length > 0) {
              for (const puesto of puestos) {
                const { id_puesto, puesto: nombre_puesto } = puesto;

                const [existing] = await db.query(
                  'SELECT * FROM elecciones_puestos WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ?',
                  [id_departamento, id_municipio, id_zona, id_puesto]
                );

                if (existing.length === 0) {
                  await db.query(
                    'INSERT INTO elecciones_puestos (id_departamento, id_municipio, id_zona, id_puesto, nombre_puesto) VALUES (?, ?, ?, ?, ?)',
                    [id_departamento, id_municipio, id_zona, id_puesto, nombre_puesto]
                  );
                }
              }
            }
          } catch (error) {
            if (error.response && error.response.status === 404) {
              // This is expected if a zone doesn't exist for a municipality.
              console.log(`No puestos found for zone ${id_zona} in municipio ${id_municipio}. Moving to next.`);
            } else {
              console.error(`Error fetching or processing puestos for URL ${url}:`, error.message);
            }
          }
        }
      }
    }

    res.status(200).send('Sync for puestos initiated. Check server logs for progress.');
  } catch (error) {
    console.error('Error syncing elecciones_puestos:', error);
    res.status(500).send('Error syncing data');
  }
};

module.exports = {
  syncPuestos,
};
