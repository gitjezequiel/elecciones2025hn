const axios = require('axios');
const pool = require('../db');
const { getHondurasTime } = require('../utils/time');
const { performMunicipalSync } = require('./municipiosVotosController'); // Import the refactored function

const postResultados = async (req, res) => {
    // ... (This function remains unchanged, so I'm omitting it for brevity)
    // The original logic is preserved here.
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

        const insertQuery = `
            INSERT INTO api_responses (departamento_nombre, departamento_codigo, response_data, created_at)
            VALUES (?, ?, ?, ?);
        `;
        await pool.query(insertQuery, [deptoNombre, deptoId, JSON.stringify(response.data), hondurasTime]);

        if (response.data && response.data.candidatos) {
            const { fecha_corte, candidatos } = response.data;
            for (const candidate of candidatos) {
                const insertCandidateQuery = `
                    INSERT INTO elecciones_candidatos (
                        fecha_corte, departamento_codigo, departamento_nombre, candidato_codigo,
                        candidato_nombres, candidato_apellidos, partido_id, partido_nombre,
                        partido_color, partido_link_logo, candidato_link_logo, votos, partido_id_int, fecha_creacion
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                `;
                await pool.query(insertCandidateQuery, [
                    fecha_corte, deptoId, deptoNombre, candidate.cddto_codigo,
                    candidate.cddto_nombres, candidate.cddto_apellidos, candidate.parpo_id,
                    candidate.parpo_nombre, candidate.parpo_color, candidate.parpo_link_logo,
                    candidate.cddto_link_logo, candidate.votos, candidate.parpo_id_int, hondurasTime
                ]);
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
        let departments;
        try {
            [departments] = await pool.query('SELECT id_departamento, nombre_departamento FROM elecciones_departamentos');
        } catch (dbError) {
            console.error('FATAL: Could not fetch departments. Aborting sync.', dbError);
            return;
        }

        for (const depto of departments) {
            const deptoId = depto.id_departamento;
            const deptoNombre = depto.nombre_departamento;
            let departmentHasChanges = false; // Flag to track changes in the department

            console.log(`--- Processing department: ${deptoNombre} (${deptoId}) ---`);
            
            // ... (The existing actas logic remains the same)
            const payload = { codigos: [], tipco: "01", depto: deptoId, comuna: "00", mcpio: "000", zona: "", pesto: "", "mesa": 0 };
            let previousActasPendientes = 0, previousInconsistencias = 0;
            try {
                const [prevActasRows] = await pool.query(`SELECT actas_pendientes, inconsistencias_actuales FROM elecciones_votos_updates WHERE departamento_codigo = ? ORDER BY fecha_actualizacion DESC LIMIT 1`, [deptoId]);
                if (prevActasRows.length > 0) {
                    previousActasPendientes = prevActasRows[0].actas_pendientes;
                    previousInconsistencias = prevActasRows[0].inconsistencias_actuales || 0;
                }
            } catch (dbError) { console.error(`Error fetching previous actas for dept ${deptoId}:`, dbError); }

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
                    const { candidatos } = response.data;
                    for (const candidate of candidatos) {
                        let previousVotosInLog = 0;
                        const [prevRows] = await pool.query( `SELECT votos_nuevos FROM elecciones_votos_updates WHERE candidato_codigo = ? AND departamento_codigo = ? AND partido_id = ? ORDER BY fecha_actualizacion DESC LIMIT 1`, [candidate.cddto_codigo, deptoId, candidate.parpo_id]);
                        if (prevRows.length > 0) {
                            previousVotosInLog = prevRows[0].votos_nuevos;
                        }

                        if (candidate.votos !== previousVotosInLog) {
                            departmentHasChanges = true; // Set the flag if a change is found
                            const difference = candidate.votos - previousVotosInLog;
                            const insertUpdateQuery = `
                                INSERT INTO elecciones_votos_updates (
                                    candidato_codigo, departamento_codigo, partido_id, votos_anteriores, votos_nuevos, diferencia, fecha_actualizacion,
                                    actas_pendientes, actas_totales, procesadas, actas_pendientes_anteriores, actas_pendientes_nuevas, diferencia_actas,
                                    inconsistencias_anteriores, inconsistencias_actuales, diferencia_de_inconsistencias, pendientes_calculadas
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                            `;
                            await pool.query(insertUpdateQuery, [
                                candidate.cddto_codigo, deptoId, candidate.parpo_id, previousVotosInLog, candidate.votos, difference, getHondurasTime(),
                                actasData.actas_pendientes, actasData.actas_totales, actasData.procesadas, previousActasPendientes, actasData.actas_pendientes, diferenciaActas,
                                previousInconsistencias, actasData.inconsistencias, diferenciaInconsistencias, pendientesCalculadas
                            ]);
                        }
                    }
                }
            } catch (apiError) {
                console.error(`An error occurred for department ${deptoId}:`, apiError.message);
            }

            // --- TRIGGER MUNICIPAL SYNC IF CHANGES WERE DETECTED ---
            if (departmentHasChanges) {
                console.log(`Changes detected in department ${deptoId}. Triggering sync for all its municipalities...`);
                try {
                    const [municipios] = await pool.query(
                        `SELECT id_municipio FROM elecciones_municipios WHERE dpto = ?`,
                        [deptoId]
                    );

                    console.log(`Found ${municipios.length} municipalities to sync for department ${deptoId}.`);
                    for (const municipio of municipios) {
                        // Not awaiting here to run syncs in the background and not block the main loop.
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

module.exports = {
    postResultados,
    syncAllDepartamentosResultados,
};