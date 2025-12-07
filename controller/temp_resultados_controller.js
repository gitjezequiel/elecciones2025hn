const db = require('../db');
const axios = require('axios');

const syncResultadosPorMesa = async (req, res) => {
  res.status(202).send('Sync for a nivel de mesa results started. This is a very long process, check server logs for progress.');

  (async () => {
    try {
      console.log('Starting full synchronization of results per mesa...');
      const [departamentos] = await db.query('SELECT id_departamento FROM elecciones_departamentos');
      
      for (const depto of departamentos) {
        const { id_departamento } = depto;
        console.log(`Processing department: ${id_departamento}`);
        const [municipios] = await db.query('SELECT id_municipio FROM elecciones_municipios WHERE dpto = ?', [id_departamento]);

        for (const muni of municipios) {
          const { id_municipio } = muni;
          console.log(`  Processing municipio: ${id_municipio}`);
          const [zonas] = await db.query('SELECT id_zona FROM elecciones_zonas');

          for (const zona of zonas) {
            const { id_zona } = zona;
            const [puestos] = await db.query('SELECT id_puesto FROM elecciones_puestos WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ?', [id_departamento, id_municipio, id_zona]);

            for (const puesto of puestos) {
              const { id_puesto } = puesto;
              const [mesas] = await db.query('SELECT id_mesa FROM elecciones_mesas WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ?', [id_departamento, id_municipio, id_zona, id_puesto]);

              for (const mesa of mesas) {
                const { id_mesa } = mesa;

                const payload = {
                  codigos: [],
                  tipco: "01",
                  depto: id_departamento,
                  comuna: "00",
                  mcpio: id_municipio,
                  zona: id_zona,
                  pesto: id_puesto,
                  mesa: id_mesa
                };

                try {
                  console.log(`    Fetching results for mesa: ${id_mesa} in puesto: ${id_puesto}`);
                  const response = await axios.post('https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados', payload);
                  const { candidatos } = response.data;

                  if (candidatos && candidatos.length > 0) {
                    for (const candidato of candidatos) {
                      const { parpo_id, votos } = candidato;
                      
                      const [existing] = await db.query(
                        'SELECT id FROM elecciones_resultados WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ? AND id_mesa = ? AND parpo_id = ?',
                        [id_departamento, id_municipio, id_zona, id_puesto, id_mesa, parpo_id]
                      );

                      if (existing.length === 0) {
                        await db.query(
                          'INSERT INTO elecciones_resultados (id_departamento, id_municipio, id_zona, id_puesto, id_mesa, parpo_id, votos) VALUES (?, ?, ?, ?, ?, ?, ?)',
                          [id_departamento, id_municipio, id_zona, id_puesto, id_mesa, parpo_id, votos]
                        );
                      } else {
                        // Optionally, update if votes are different
                        await db.query(
                          'UPDATE elecciones_resultados SET votos = ? WHERE id = ?',
                          [votos, existing[0].id]
                        );
                      }
                    }
                  }
                } catch (error) {
                  if (error.response) {
                    console.error(`      Error fetching results for payload ${JSON.stringify(payload)}: Status ${error.response.status}`);
                  } else {
                    console.error(`      Error fetching results for payload ${JSON.stringify(payload)}:`, error.message);
                  }
                }
              }
            }
          }
        }
      }
      console.log('--- Full synchronization of results per mesa finished. ---');
    } catch (error) {
      console.error('A critical error occurred during the main sync loop:', error);
    }
  })();
};

module.exports = {
    // I need to get the existing exports and add this one
};
