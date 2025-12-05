const axios = require('axios');
const pool = require('../db');
const { getHondurasTime } = require('../utils/time');

const postResultados = async (req, res) => {
    try {
        const payload = req.body;
        const deptoId = payload.depto;
        const hondurasTime = getHondurasTime();

        // Fetch department name from the database
        let deptoNombre;
        try {
            const [rows] = await pool.query('SELECT nombre_departamento FROM elecciones_departamentos WHERE id_departamento = ?', [deptoId]);
            if (rows.length > 0) {
                deptoNombre = rows[0].nombre_departamento;
            } else {
                return res.status(404).json({ message: `Department with ID ${deptoId} not found.` });
            }
        } catch (dbError) {
            console.error('Error fetching department from database:', dbError);
            return res.status(500).json({ message: 'Error fetching department data.' });
        }

        const response = await axios.post('https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados', payload);

        const responseData = {
            ...response.data,
            departamento_nombre: deptoNombre,
            departamento_codigo: deptoId,
        };

        // Save to database
        try {
            const insertQuery = `
                INSERT INTO api_responses (departamento_nombre, departamento_codigo, response_data, created_at)
                VALUES (?, ?, ?, ?);
            `;
            await pool.query(insertQuery, [deptoNombre, deptoId, JSON.stringify(response.data), hondurasTime]);
            console.log(`API response for department ${deptoId} saved to database.`);
        } catch (dbError) {
            console.error(`Error saving API response for department ${deptoId} to database:`, dbError);
        }

        // Insert each candidate into elecciones_candidatos table
        if (response.data && response.data.candidatos) {
            try {
                const { fecha_corte, candidatos } = response.data;

                for (const candidate of candidatos) {
                    const insertCandidateQuery = `
                        INSERT INTO elecciones_candidatos (
                            fecha_corte, departamento_codigo, departamento_nombre, candidato_codigo,
                            candidato_nombres, candidato_apellidos, partido_id, partido_nombre,
                            partido_color, partido_link_logo, candidato_link_logo, votos, partido_id_int, fecha_creacion
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    `;
                    const values = [
                        fecha_corte, deptoId, deptoNombre, candidate.cddto_codigo,
                        candidate.cddto_nombres, candidate.cddto_apellidos, candidate.parpo_id,
                        candidate.parpo_nombre, candidate.parpo_color, candidate.parpo_link_logo,
                        candidate.cddto_link_logo, candidate.votos, candidate.parpo_id_int, hondurasTime
                    ];
                    await pool.query(insertCandidateQuery, values);
                }
                console.log(`All candidates for department ${deptoId} inserted successfully.`);
            } catch (dbError) {
                console.error(`Error inserting candidates for department ${deptoId}:`, dbError);
            }
        }

        res.json(responseData);
    } catch (error) {
        // Axios or other unexpected errors
        if (error.response) {
            console.error(`Error contacting external API for department ${req.body.depto}:`, error.response.status, error.response.data);
        } else {
            console.error(`Error processing department ${req.body.depto}:`, error.message);
        }
        res.status(500).send('Error processing results for department.');
    }
};

const syncAllDepartamentosResultados = async (req, res) => {
    // Immediately respond to the client
    res.status(202).json({ message: 'Synchronization process started. This may take some time.' });

    // Run the synchronization in the background
    (async () => {
        console.log('Starting full synchronization of all departments...');
        let departments;
        try {
            [departments] = await pool.query('SELECT id_departamento, nombre_departamento FROM elecciones_departamentos');
        } catch (dbError) {
            console.error('FATAL: Could not fetch departments from database. Aborting sync.', dbError);
            return; // Exit if we can't get the list of departments
        }

        for (const depto of departments) {
            const deptoId = depto.id_departamento;
            const deptoNombre = depto.nombre_departamento;
            const hondurasTime = getHondurasTime();
            
            console.log(`--- Processing department: ${deptoNombre} (${deptoId}) ---`);

            const payload = {
                codigos: [],
                tipco: "01",
                depto: deptoId,
                comuna: "00",
                mcpio: "000",
                zona: "",
                pesto: "",
                "mesa": 0
            };

            // --- DECOUPLED ACTAS LOGIC ---
            // 1. Get previous actas data for the department
            let previousActasPendientes = 0;
            let previousInconsistencias = 0;
            try {
                const [prevActasRows] = await pool.query(
                    `SELECT actas_pendientes, inconsistencias_actuales FROM elecciones_votos_updates
                     WHERE departamento_codigo = ?
                     ORDER BY fecha_actualizacion DESC LIMIT 1`,
                    [deptoId]
                );
                if (prevActasRows.length > 0) {
                    previousActasPendientes = prevActasRows[0].actas_pendientes;
                    previousInconsistencias = prevActasRows[0].inconsistencias_actuales || 0;
                }
            } catch (dbError) {
                console.error(`Error fetching previous actas data for department ${deptoId}:`, dbError);
            }

            // 2. Fetch current actas data for the department
            let actasData = { actas_pendientes: 0, actas_totales: 0, procesadas: 0, inconsistencias: 0 };
            try {
                const actasResponse = await axios.post('https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados/actas-validas', payload);
                actasData = {
                    actas_pendientes: actasResponse.data.espera || 0,
                    actas_totales: actasResponse.data.total || 0,
                    procesadas: actasResponse.data.publicadas || 0,
                    inconsistencias: actasResponse.data.inconsistencias || 0,
                };
                console.log(`Actas data for department ${deptoId} fetched successfully.`);
            } catch (actasError) {
                console.error(`Could not fetch actas data for department ${deptoId}. Using default values.`, actasError.message);
            }
            
            // 3. Calculate actas and inconsistencias difference
            const diferenciaActas = actasData.actas_pendientes - previousActasPendientes;
            const diferenciaInconsistencias = actasData.inconsistencias - previousInconsistencias;
            const pendientesCalculadas = actasData.actas_totales - actasData.procesadas;
            // --- END OF ACTAS LOGIC ---


            try {
                const response = await axios.post('https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados', payload);

                // Save to api_responses table
                try {
                    const insertQuery = `
                        INSERT INTO api_responses (departamento_nombre, departamento_codigo, response_data, created_at)
                        VALUES (?, ?, ?, ?);
                    `;
                    await pool.query(insertQuery, [deptoNombre, deptoId, JSON.stringify(response.data), hondurasTime]);
                    console.log(`API response for department ${deptoId} saved.`);
                } catch (dbError) {
                    console.error(`Error saving API response for ${deptoId} to database:`, dbError);
                }

                // Insert candidates
                if (response.data && response.data.candidatos) {
                    const { fecha_corte, candidatos } = response.data;
                    console.log(`Found ${candidatos.length} candidates for department ${deptoId}.`);
                    for (const candidate of candidatos) {
                        let previousVotosInLog = 0;
                        try {
                            const [prevRows] = await pool.query(
                                `SELECT votos_nuevos FROM elecciones_votos_updates
                                 WHERE candidato_codigo = ? AND departamento_codigo = ? AND partido_id = ?
                                 ORDER BY fecha_actualizacion DESC LIMIT 1`,
                                [candidate.cddto_codigo, deptoId, candidate.parpo_id]
                            );
                            if (prevRows.length > 0) {
                                previousVotosInLog = prevRows[0].votos_nuevos;
                            }
                        } catch (dbError) {
                            console.error(`Error fetching previous votes for candidate ${candidate.cddto_codigo} from log table:`, dbError);
                        }

                        const currentVotos = candidate.votos;

                        // Log only if votes have changed since the last log
                        if (currentVotos !== previousVotosInLog) {
                            const difference = currentVotos - previousVotosInLog;
                            console.log(`Vote change detected for candidate ${candidate.cddto_codigo} in department ${deptoId}: from ${previousVotosInLog} to ${currentVotos}. Difference: ${difference}`);

                            try {
                                const insertUpdateQuery = `
                                    INSERT INTO elecciones_votos_updates (
                                        candidato_codigo, departamento_codigo, partido_id,
                                        votos_anteriores, votos_nuevos, diferencia, fecha_actualizacion,
                                        actas_pendientes, actas_totales, procesadas,
                                        actas_pendientes_anteriores, actas_pendientes_nuevas, diferencia_actas,
                                        inconsistencias_anteriores, inconsistencias_actuales, diferencia_de_inconsistencias,
                                        pendientes_calculadas
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                                `;
                                await pool.query(insertUpdateQuery, [
                                    candidate.cddto_codigo, deptoId, candidate.parpo_id,
                                    previousVotosInLog, currentVotos, difference, hondurasTime,
                                    actasData.actas_pendientes, actasData.actas_totales, actasData.procesadas,
                                    previousActasPendientes, actasData.actas_pendientes, diferenciaActas,
                                    previousInconsistencias, actasData.inconsistencias, diferenciaInconsistencias,
                                    pendientesCalculadas
                                ]);
                                console.log(`Vote and actas update logged for candidate ${candidate.cddto_codigo} in department ${deptoId}.`);
                            } catch (dbError) {
                                console.error(`Error logging vote and actas update for candidate ${candidate.cddto_codigo} in department ${deptoId}:`, dbError);
                            }
                        }

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
                    console.log(`Successfully inserted candidates for department ${deptoId}.`);
                }
            } catch (apiError) {
                if (apiError.response) {
                    console.error(`Error contacting external API for department ${deptoId}:`, apiError.response.status, apiError.response.data);
                } else {
                    console.error(`An unexpected error occurred for department ${deptoId}:`, apiError.message);
                }
                // Continue to the next department
            }
        }
        console.log('--- Full synchronization process finished. ---');
    })();
};

module.exports = {
    postResultados,
    syncAllDepartamentosResultados,
};
