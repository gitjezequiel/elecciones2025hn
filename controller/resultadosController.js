const axios = require('axios');
const pool = require('../db');
const { getHondurasTime } = require('../utils/time');
const { performMunicipalSync } = require('./municipiosVotosController');

// Helper function to process a single mesa
async function processMesa(id_departamento, id_municipio, id_zona, id_puesto, id_mesa) {
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
        console.log(`    Fetching results for mesa: ${id_mesa} in puesto: ${id_puesto}, muni: ${id_municipio}, depto: ${id_departamento}`);
        const response = await axios.post('https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados', payload);
        const { candidatos } = response.data;

        if (candidatos && candidatos.length > 0) {
            for (const candidato of candidatos) {
                const { parpo_id, votos } = candidato;

                const [existing] = await pool.query(
                    'SELECT id FROM elecciones_resultados WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ? AND id_mesa = ? AND parpo_id = ?',
                    [id_departamento, id_municipio, id_zona, id_puesto, id_mesa, parpo_id]
                );

                if (existing.length === 0) {
                    await pool.query(
                        'INSERT INTO elecciones_resultados (id_departamento, id_municipio, id_zona, id_puesto, id_mesa, parpo_id, votos) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [id_departamento, id_municipio, id_zona, id_puesto, id_mesa, parpo_id, votos]
                    );
                } else {
                    await pool.query(
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


// ... (postResultados and syncAllDepartamentosResultados functions are preserved here)
const postResultados = async (req, res) => {
    try {
        const payload = req.body;
        const deptoId = payload.depto;
        const hondurasTime = getHondurasTime();

        let deptoNombre;
        const [rows] = await pool.query('SELECT nombre_departamento FROM elecciones_departamentos WHERE id_departamento = ?', [deptoId]);
        if (rows.length > 0) {
            deptoNombre = rows[0].nombre_departamento;
        } else {
            return res.status(404).json({ message: `Department with ID ${deptoId} not found.` });
        }

        const response = await axios.post('https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados', payload);

        const responseData = {
            ...response.data,
            departamento_nombre: deptoNombre,
            departamento_codigo: deptoId,
        };

        await pool.query(
            `INSERT INTO api_responses (departamento_nombre, departamento_codigo, response_data, created_at) VALUES (?, ?, ?, ?);`,
            [deptoNombre, deptoId, JSON.stringify(response.data), hondurasTime]
        );

        if (response.data && response.data.candidatos) {
            const { fecha_corte, candidatos } = response.data;
            for (const candidate of candidatos) {
                 await pool.query(
                    `INSERT INTO elecciones_candidatos (
                        fecha_corte, departamento_codigo, departamento_nombre, candidato_codigo,
                        candidato_nombres, candidato_apellidos, partido_id, partido_nombre,
                        partido_color, partido_link_logo, candidato_link_logo, votos, partido_id_int, fecha_creacion
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                    [
                        fecha_corte, deptoId, deptoNombre, candidate.cddto_codigo,
                        candidate.cddto_nombres, candidate.cddto_apellidos, candidate.parpo_id,
                        candidate.parpo_nombre, candidate.parpo_color, candidate.parpo_link_logo,
                        candidate.cddto_link_logo, candidate.votos, candidate.parpo_id_int, hondurasTime
                    ]
                );
            }
        }
        res.json(responseData);
    } catch (error) {
        console.error(`Error processing department ${req.body.depto}:`, error.message);
        res.status(500).send('Error processing results for department.');
    }
};

const syncAllDepartamentosResultados = async (req, res) => {
    res.status(202).json({ message: 'Synchronization process started. This may take some time.' });

    (async () => {
        console.log('Starting full synchronization of all departments...');
        const [departments] = await pool.query('SELECT id_departamento, nombre_departamento FROM elecciones_departamentos');

        for (const depto of departments) {
            const deptoId = depto.id_departamento;
            const deptoNombre = depto.nombre_departamento;
            let departmentHasChanges = false;

            console.log(`--- Processing department: ${deptoNombre} (${deptoId}) ---`);
            const payload = { codigos: [], tipco: "01", depto: deptoId, comuna: "00", mcpio: "000", zona: "", pesto: "", "mesa": 0 };
            
            let previousActasPendientes = 0, previousInconsistencias = 0;
            const [prevActasRows] = await pool.query(`SELECT actas_pendientes, inconsistencias_actuales FROM elecciones_votos_updates WHERE departamento_codigo = ? ORDER BY fecha_actualizacion DESC LIMIT 1`, [deptoId]);
            if (prevActasRows.length > 0) {
                previousActasPendientes = prevActasRows[0].actas_pendientes;
                previousInconsistencias = prevActasRows[0].inconsistencias_actuales || 0;
            }

            let actasData = { actas_pendientes: 0, actas_totales: 0, procesadas: 0, inconsistencias: 0 };
            try {
                const actasResponse = await axios.post('https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados/actas-validas', payload);
                actasData = { actas_pendientes: actasResponse.data.espera || 0, actas_totales: actasResponse.data.total || 0, procesadas: actasResponse.data.publicadas || 0, inconsistencias: actasResponse.data.inconsistencias || 0 };
            } catch (actasError) { console.error(`Could not fetch actas data for dept ${deptoId}.`, actasError.message); }
            
            const diferenciaActas = actasData.actas_pendientes - previousActasPendientes;
            const diferenciaInconsistencias = actasData.inconsistencias - previousInconsistencias;
            const pendientesCalculadas = actasData.actas_totales - actasData.procesadas;

            try {
                const response = await axios.post('https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados', payload);
                if (response.data && response.data.candidatos) {
                    for (const candidate of response.data.candidatos) {
                        let previousVotosInLog = 0;
                        const [prevRows] = await pool.query( `SELECT votos_nuevos FROM elecciones_votos_updates WHERE candidato_codigo = ? AND departamento_codigo = ? AND partido_id = ? ORDER BY fecha_actualizacion DESC LIMIT 1`, [candidate.cddto_codigo, deptoId, candidate.parpo_id]);
                        if (prevRows.length > 0) {
                            previousVotosInLog = prevRows[0].votos_nuevos;
                        }

                        if (candidate.votos !== previousVotosInLog) {
                            departmentHasChanges = true;
                            const difference = candidate.votos - previousVotosInLog;
                            await pool.query(
                                `INSERT INTO elecciones_votos_updates (
                                    candidato_codigo, departamento_codigo, partido_id, votos_anteriores, votos_nuevos, diferencia, fecha_actualizacion,
                                    actas_pendientes, actas_totales, procesadas, actas_pendientes_anteriores, actas_pendientes_nuevas, diferencia_actas,
                                    inconsistencias_anteriores, inconsistencias_actuales, diferencia_de_inconsistencias, pendientes_calculadas
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                                [
                                    candidate.cddto_codigo, deptoId, candidate.parpo_id, previousVotosInLog, candidate.votos, difference, getHondurasTime(),
                                    actasData.actas_pendientes, actasData.actas_totales, actasData.procesadas, previousActasPendientes, actasData.actas_pendientes, diferenciaActas,
                                    previousInconsistencias, actasData.inconsistencias, diferenciaInconsistencias, pendientesCalculadas
                                ]
                            );
                        }
                    }
                }
            } catch (apiError) {
                console.error(`An error occurred for department ${deptoId}:`, apiError.message);
            }

            if (departmentHasChanges) {
                console.log(`Changes detected in department ${deptoId}. Triggering sync for all its municipalities...`);
                try {
                    const [municipios] = await pool.query(`SELECT id_municipio FROM elecciones_municipios WHERE dpto = ?`,[deptoId]);
                    console.log(`Found ${municipios.length} municipalities to sync for department ${deptoId}.`);
                    for (const municipio of municipios) {
                        performMunicipalSync(deptoId, municipio.id_municipio);
                    }
                } catch (dbError) {
                    console.error(`Failed to fetch or trigger sync for municipalities in department ${deptoId}:`, dbError);
                }
            } else {
                console.log(`No vote changes detected for department ${deptoId}. Skipping municipal sync.`);
            }
        }
        console.log('--- Full synchronization process finished. ---');
    })();
};

const getLatestDepartmentResults = async (req, res) => {
    try {
        const { deptoId } = req.params;
        const query = `
            SELECT 
                upd.candidato_codigo,
                upd.partido_id,
                upd.votos_nuevos,
                c.candidato_nombres,
                c.partido_nombre,
                c.partido_color
            FROM 
                elecciones_votos_updates upd
            INNER JOIN (
                SELECT 
                    candidato_codigo, 
                    partido_id, 
                    MAX(fecha_actualizacion) AS max_fecha
                FROM 
                    elecciones_votos_updates
                WHERE 
                    departamento_codigo = ?
                GROUP BY 
                    candidato_codigo, partido_id
            ) latest_upd ON upd.candidato_codigo = latest_upd.candidato_codigo AND upd.partido_id = latest_upd.partido_id AND upd.fecha_actualizacion = latest_upd.max_fecha
            LEFT JOIN (
                SELECT 
                    candidato_codigo,
                    partido_id,
                    candidato_nombres,
                    partido_nombre,
                    partido_color,
                    ROW_NUMBER() OVER(PARTITION BY candidato_codigo, partido_id, departamento_codigo ORDER BY fecha_creacion DESC) as rn
                FROM 
                    elecciones_candidatos
                WHERE
                    departamento_codigo = ?
            ) c ON upd.candidato_codigo = c.candidato_codigo AND upd.partido_id = c.partido_id AND c.rn = 1
            WHERE 
                upd.departamento_codigo = ?
            ORDER BY 
                upd.votos_nuevos DESC;
        `;
        const [rows] = await pool.query(query, [deptoId, deptoId, deptoId]);
        res.json(rows);
    } catch (error) {
        console.error(`Error fetching latest results for department ${req.params.deptoId}:`, error);
        res.status(500).json({ message: 'Error fetching latest results.' });
    }
};

const syncResultadosPorMesa = async (req, res) => {
  res.status(202).send('Sync for a nivel de mesa results started. This is a very long process, check server logs for progress.');

  (async () => {
    try {
      console.log('Starting full synchronization of results per mesa...');
      const [departamentos] = await pool.query('SELECT id_departamento FROM elecciones_departamentos ORDER BY id_departamento ASC');
      
      for (const depto of departamentos) {
        const { id_departamento } = depto;
        console.log(`Processing department: ${id_departamento}`);
        const [municipios] = await pool.query('SELECT id_municipio FROM elecciones_municipios WHERE dpto = ? ORDER BY id_municipio ASC', [id_departamento]);

        for (const muni of municipios) {
          const { id_municipio } = muni;
          const [zonas] = await pool.query('SELECT id_zona FROM elecciones_zonas ORDER BY id_zona ASC');

          for (const zona of zonas) {
            const { id_zona } = zona;
            const [puestos] = await pool.query('SELECT id_puesto FROM elecciones_puestos WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? ORDER BY id_puesto ASC', [id_departamento, id_municipio, id_zona]);

            for (const puesto of puestos) {
              const { id_puesto } = puesto;
              const [mesas] = await pool.query('SELECT id_mesa FROM elecciones_mesas WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ? ORDER BY id_mesa ASC', [id_departamento, id_municipio, id_zona, id_puesto]);

              for (const mesa of mesas) {
                await processMesa(id_departamento, id_municipio, id_zona, id_puesto, mesa.id_mesa);
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

const resumeSyncResultadosPorMesa = async (req, res) => {
    const { startDepto, startMuni, startZona, startPuesto, startMesa } = req.body;

    if (!startDepto || !startMuni || !startZona || !startPuesto || !startMesa) {
        return res.status(400).send('Missing required body parameters: startDepto, startMuni, startZona, startPuesto, startMesa');
    }

    res.status(202).send(`Resuming sync for results per mesa from depto: ${startDepto}, muni: ${startMuni}, zona: ${startZona}, puesto: ${startPuesto}, mesa: ${startMesa}.`);

    (async () => {
        try {
            console.log(`--- Resuming synchronization from depto: ${startDepto}, muni: ${startMuni}, zona: ${startZona}, puesto: ${startPuesto}, mesa: ${startMesa} ---`);
            const [departamentos] = await pool.query('SELECT id_departamento FROM elecciones_departamentos ORDER BY id_departamento ASC');
            
            let pastStartDepto = false;
            let pastStartMuni = false;
            let pastStartZona = false;
            let pastStartPuesto = false;
            let pastStartMesa = false;

            for (const depto of departamentos) {
                const { id_departamento } = depto;
                if (!pastStartDepto && id_departamento < startDepto) continue;
                pastStartDepto = true;

                console.log(`Processing department: ${id_departamento}`);
                const [municipios] = await pool.query('SELECT id_municipio FROM elecciones_municipios WHERE dpto = ? ORDER BY id_municipio ASC', [id_departamento]);

                for (const muni of municipios) {
                    const { id_municipio } = muni;
                    if (!pastStartMuni && id_departamento === startDepto && id_municipio < startMuni) continue;
                    pastStartMuni = true;

                    const [zonas] = await pool.query('SELECT id_zona FROM elecciones_zonas ORDER BY id_zona ASC');

                    for (const zona of zonas) {
                        const { id_zona } = zona;
                        if (!pastStartZona && id_departamento === startDepto && id_municipio === startMuni && id_zona < startZona) continue;
                        pastStartZona = true;

                        const [puestos] = await pool.query('SELECT id_puesto FROM elecciones_puestos WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? ORDER BY id_puesto ASC', [id_departamento, id_municipio, id_zona]);

                        for (const puesto of puestos) {
                            const { id_puesto } = puesto;
                            if (!pastStartPuesto && id_departamento === startDepto && id_municipio === startMuni && id_zona === startZona && id_puesto < startPuesto) continue;
                            pastStartPuesto = true;

                            const [mesas] = await pool.query('SELECT id_mesa FROM elecciones_mesas WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ? ORDER BY id_mesa ASC', [id_departamento, id_municipio, id_zona, id_puesto]);

                            for (const mesa of mesas) {
                                if (!pastStartMesa && id_departamento === startDepto && id_municipio === startMuni && id_zona === startZona && id_puesto === startPuesto && mesa.id_mesa < startMesa) continue;
                                pastStartMesa = true;
                                
                                await processMesa(id_departamento, id_municipio, id_zona, id_puesto, mesa.id_mesa);
                            }
                        }
                    }
                }
            }
            console.log('--- Resumed synchronization finished. ---');
        } catch (error) {
            console.error('A critical error occurred during the resumed sync loop:', error);
        }
    })();
};


module.exports = {
    postResultados,
    syncAllDepartamentosResultados,
    getLatestDepartmentResults,
    syncResultadosPorMesa,
    resumeSyncResultadosPorMesa
};
