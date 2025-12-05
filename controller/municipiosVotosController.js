const pool = require('../db');
const axios = require('axios');
const { getHondurasTime } = require('../utils/time');

const SYNC_API_URL = 'https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados';
const ACTAS_API_URL = 'https://resultadosgenerales2025-api.cne.hn/esc/v1/presentacion-resultados/actas-validas';

/**
 * Performs the synchronization logic for a single municipality.
 * @param {string} departamento_codigo - The department code.
 * @param {string} municipio_codigo - The municipality code.
 */
const performMunicipalSync = async (departamento_codigo, municipio_codigo) => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log(`Syncing votes for dpto: ${departamento_codigo}, mcpio: ${municipio_codigo}`);
        const hondurasTime = getHondurasTime();

        // --- ACTAS LOGIC ---
        let previousActasPendientes = 0;
        let previousInconsistencias = 0;
        try {
            const [prevActasRows] = await connection.query(
                `SELECT actas_pendientes, inconsistencias_actuales FROM elecciones_municipios_votos_updates
                 WHERE departamento_codigo = ? AND municipio_codigo = ?
                 ORDER BY fecha_actualizacion DESC LIMIT 1`,
                [departamento_codigo, municipio_codigo]
            );
            if (prevActasRows.length > 0) {
                previousActasPendientes = prevActasRows[0].actas_pendientes;
                previousInconsistencias = prevActasRows[0].inconsistencias_actuales || 0;
            }
        } catch (dbError) {
            console.error(`Error fetching previous actas data for municipio ${municipio_codigo}:`, dbError);
        }

        const apiPayload = {
            "codigos": [], "tipco": "01", "depto": departamento_codigo,
            "comuna": "00", "mcpio": municipio_codigo, "zona": "",
            "pesto": "", "mesa": 0
        };

        let actasData = { actas_pendientes: 0, actas_totales: 0, procesadas: 0, inconsistencias: 0 };
        try {
            const actasResponse = await axios.post(ACTAS_API_URL, apiPayload);
            actasData = {
                actas_pendientes: actasResponse.data.espera || 0,
                actas_totales: actasResponse.data.total || 0,
                procesadas: actasResponse.data.publicadas || 0,
                inconsistencias: actasResponse.data.inconsistencias || 0,
            };
        } catch (actasError) {
            console.error(`Could not fetch actas data for municipio ${municipio_codigo}.`, actasError.message);
        }

        const diferenciaActas = actasData.actas_pendientes - previousActasPendientes;
        const diferenciaInconsistencias = actasData.inconsistencias - previousInconsistencias;
        const pendientesCalculadas = actasData.actas_totales - actasData.procesadas;
        // --- END OF ACTAS LOGIC ---

        const apiResponse = await axios.post(SYNC_API_URL, apiPayload);
        const { candidatos } = apiResponse.data;

        if (!Array.isArray(candidatos)) {
            console.warn(`[${municipio_codigo}] API response "candidatos" is not an array.`);
            return; // Exit if format is wrong
        }

        let changesCount = 0;
        for (const candidato of candidatos) {
            const candidato_codigo = candidato.cddto_codigo;
            const partido_id = candidato.parpo_id;
            const currentVotos = candidato.votos;

            if (candidato_codigo === undefined || partido_id === undefined || currentVotos === undefined) {
                continue;
            }

            let previousVotos = 0;
            const [prevRows] = await connection.query(
                `SELECT votos_nuevos FROM elecciones_municipios_votos_updates
                 WHERE candidato_codigo = ? AND departamento_codigo = ? AND municipio_codigo = ? AND partido_id = ?
                 ORDER BY fecha_actualizacion DESC LIMIT 1`,
                [candidato_codigo, departamento_codigo, municipio_codigo, partido_id]
            );
            if (prevRows.length > 0) {
                previousVotos = prevRows[0].votos_nuevos;
            }

            if (currentVotos !== previousVotos) {
                changesCount++;
                const difference = currentVotos - previousVotos;
                const insertUpdateQuery = `
                    INSERT INTO elecciones_municipios_votos_updates (
                        candidato_codigo, departamento_codigo, municipio_codigo, partido_id,
                        votos_anteriores, votos_nuevos, diferencia, fecha_actualizacion,
                        actas_pendientes, actas_totales, procesadas,
                        actas_pendientes_anteriores, actas_pendientes_nuevas, diferencia_actas,
                        inconsistencias_anteriores, inconsistencias_actuales, diferencia_de_inconsistencias,
                        pendientes_calculadas
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                `;
                await connection.query(insertUpdateQuery, [
                    candidato_codigo, departamento_codigo, municipio_codigo, partido_id,
                    previousVotos, currentVotos, difference, hondurasTime,
                    actasData.actas_pendientes, actasData.actas_totales, actasData.procesadas,
                    previousActasPendientes, actasData.actas_pendientes, diferenciaActas,
                    previousInconsistencias, actasData.inconsistencias, diferenciaInconsistencias,
                    pendientesCalculadas
                ]);
            }
        }
        console.log(`[${municipio_codigo}] Sync complete. ${changesCount} changes logged.`);
    } catch (error) {
        console.error(`Error during municipal sync for mcpio ${municipio_codigo}:`, error.message);
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

/**
 * Express controller to trigger municipal sync via HTTP POST.
 */
const syncMunicipiosVotos = async (req, res) => {
    const { departamento_codigo, municipio_codigo } = req.body;

    if (!departamento_codigo || !municipio_codigo) {
        return res.status(400).json({ message: 'Missing departamento_codigo or municipio_codigo in request body.' });
    }

    // Don't await, run in background
    performMunicipalSync(departamento_codigo, municipio_codigo);

    res.status(202).json({ message: 'Municipal sync process started.' });
};

module.exports = {
    syncMunicipiosVotos,
    performMunicipalSync // Export for reuse
};
