const db = require('../db');
const axios = require('axios');

const syncMesas = async (req, res) => {
  try {
    const [departamentos] = await db.query('SELECT id_departamento FROM elecciones_departamentos');
    
    for (const depto of departamentos) {
      const { id_departamento } = depto;
      const [municipios] = await db.query('SELECT id_municipio FROM elecciones_municipios WHERE dpto = ?', [id_departamento]);

      for (const muni of municipios) {
        const { id_municipio } = muni;
        const [zonas] = await db.query('SELECT id_zona FROM elecciones_zonas');

        for (const zona of zonas) {
          const { id_zona } = zona;
          const [puestos] = await db.query('SELECT id_puesto FROM elecciones_puestos WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ?', [id_departamento, id_municipio, id_zona]);

          for (const puesto of puestos) {
            const { id_puesto } = puesto;
            const url = `https://resultadosgenerales2025-api.cne.hn/esc/v1/actas-documentos/01/${id_departamento}/${id_municipio}/${id_zona}/${id_puesto}/mesas`;

            try {
              console.log(`Fetching mesas from: ${url}`);
              const response = await axios.get(url);
              const mesas = response.data;

              if (mesas && mesas.length > 0) {
                for (const mesa of mesas) {
                  const { publicada, numero, escrutado, digitalizado, id_informacion_mesa_corporacion, nombre_archivo, etiquetas } = mesa;
                  
                  const etiquetasStr = etiquetas ? etiquetas.join(',') : '';

                  const [existing] = await db.query(
                    'SELECT * FROM elecciones_mesas WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ? AND id_mesa = ?',
                    [id_departamento, id_municipio, id_zona, id_puesto, numero]
                  );

                  if (existing.length === 0) {
                    await db.query(
                      'INSERT INTO elecciones_mesas (id_departamento, id_municipio, id_zona, id_puesto, id_mesa, publicada, escrutado, digitalizado, id_informacion_mesa_corporacion, nombre_archivo, etiquetas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                      [id_departamento, id_municipio, id_zona, id_puesto, numero, publicada, escrutado, digitalizado, id_informacion_mesa_corporacion, nombre_archivo, etiquetasStr]
                    );
                  }
                }
              }
            } catch (error) {
              if (error.response && error.response.status === 404) {
                console.log(`No mesas found for URL ${url}. Moving to next.`);
              } else {
                console.error(`Error fetching or processing mesas for URL ${url}:`, error.message);
              }
            }
          }
        }
      }
    }

    res.status(200).send('Sync for mesas initiated. Check server logs for progress.');
  } catch (error) {
    console.error('Error syncing elecciones_mesas:', error);
    res.status(500).send('Error syncing data');
  }
};

module.exports = {
  syncMesas,
};
