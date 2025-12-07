const db = require('../db');
const axios = require('axios');

const syncEleccionesMunicipios = async (req, res) => {
  try {
    const [departamentos] = await db.query('SELECT id_departamento FROM elecciones_departamentos');

    for (const depto of departamentos) {
      const { id_departamento } = depto;
      const url = `https://resultadosgenerales2025-api.cne.hn/esc/v1/actas-documentos/01/${id_departamento}/municipios`;
      console.log(`Fetching municipios from: ${url}`);

      try {
        const response = await axios.get(url);
        const municipios = response.data;

        for (const municipio of municipios) {
          const { id_municipio, municipio: nombre_municipio } = municipio;

          const [existing] = await db.query(
            'SELECT * FROM elecciones_municipios WHERE id_municipio = ? AND dpto = ?',
            [id_municipio, id_departamento]
          );

          if (existing.length === 0) {
            await db.query(
              'INSERT INTO elecciones_municipios (id_municipio, nombre_municipio, dpto) VALUES (?, ?, ?)',
              [id_municipio, nombre_municipio, id_departamento]
            );
          }
        }
      } catch (error) {
        console.error(`Error fetching or processing municipios for department ${id_departamento}:`, error);
      }
    }

    res.status(200).send('Sync completed');
  } catch (error) {
    console.error('Error syncing elecciones_municipios:', error);
    res.status(500).send('Error syncing data');
  }
};

module.exports = {
  syncEleccionesMunicipios,
};