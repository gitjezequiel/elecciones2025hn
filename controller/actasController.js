const axios = require('axios');
const pool = require('../db');
const pdf = require('pdf-parse');

// A helper function to find all indices of a substring
function getAllIndices(arr, val) {
    var indices = [], i = -1;
    while ((i = arr.indexOf(val, i + 1)) != -1) {
        indices.push(i);
    }
    return indices;
}

// A helper function to convert spanish number words to numbers
function wordToNumber(word) {
    const wordMap = {
        'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
        'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
        'veinte': 20, 'veintiuno': 21, 'veintidos': 22, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29,
        'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
        'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300, 'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600, 'setecientos': 700, 'ochocientos': 800, 'novecientos': 900,
        'mil': 1000
    };

    const parts = word.toLowerCase().replace(/ y /g, ' ').split(/[\s-]+/);
    let number = 0;
    let tempNumber = 0;

    for (const part of parts) {
        if (wordMap[part]) {
            if (wordMap[part] === 1000) {
                tempNumber = tempNumber === 0 ? 1 : tempNumber;
                number += tempNumber * 1000;
                tempNumber = 0;
            } else if (wordMap[part] === 100) {
                 tempNumber = tempNumber === 0 ? 1 : tempNumber;
                 tempNumber *= 100;
            }
            else {
                tempNumber += wordMap[part];
            }
        }
    }
    number += tempNumber;
    return number;
}


async function processActaPDF(mesaInfo, departmentInfo, partyList) {
    if (!mesaInfo.nombre_archivo || !mesaInfo.nombre_archivo.startsWith('http')) {
        console.log(`      Skipping mesa ${mesaInfo.numero} due to invalid PDF URL.`);
        return;
    }

    try {
        const response = await axios.get(mesaInfo.nombre_archivo, { responseType: 'arraybuffer' });
        const data = await pdf(response.data);
        const text = data.text.replace(/\s+/g, ' ').toUpperCase(); // Normalize text

        for (const party of partyList) {
            const partyNameForSearch = party.partido_nombre.toUpperCase();
            const partyNameIndices = getAllIndices(text, partyNameForSearch);

            if (partyNameIndices.length === 0) continue;
            
            // Assume the relevant data is after the first mention of the party name
            const searchIndex = partyNameIndices[0];
            const searchArea = text.substring(searchIndex, searchIndex + 400); // Look in a 400-char window

            const numerosMatch = searchArea.match(/EN NÚMEROS\s*(\d)\s*(\d)\s*(\d)/);
            if (!numerosMatch) continue;
            
            const v_pdf_str = `${numerosMatch[1]}${numerosMatch[2]}${numerosMatch[3]}`;
            const votos_pdf = parseInt(v_pdf_str, 10);

            const letrasMatch = searchArea.match(/EN LETRAS\s*\((.*?)\)/);
            const votos_en_letras = letrasMatch ? letrasMatch[1].trim() : null;

            let inconsistencia = false;
            if (votos_en_letras) {
                const letras_a_numero = wordToNumber(votos_en_letras);
                if(letras_a_numero !== votos_pdf) {
                    inconsistencia = true;
                }
            }
            
            const [sitioRows] = await pool.query('SELECT votos FROM elecciones_resultados WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ? AND id_mesa = ? AND parpo_id = ?',
                [departmentInfo.id_departamento, departmentInfo.id_municipio, departmentInfo.id_zona, departmentInfo.id_puesto, mesaInfo.numero, party.id_partido]
            );
            
            const votos_sitio = sitioRows.length > 0 ? sitioRows[0].votos : null;
            const diferencia = votos_sitio !== null ? votos_pdf - votos_sitio : null;

            const [existing] = await pool.query('SELECT id FROM elecciones_actas_pdf WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ? AND id_mesa = ? AND id_partido = ?',
                 [departmentInfo.id_departamento, departmentInfo.id_municipio, departmentInfo.id_zona, departmentInfo.id_puesto, mesaInfo.numero, party.id_partido]
            );

            if (existing.length === 0) {
                 await pool.query(
                    `INSERT INTO elecciones_actas_pdf (id_departamento, id_municipio, id_zona, id_puesto, id_mesa, id_partido, votos_pdf, votos_sitio, diferencia_entre_sitio, votos_en_letras, inconsistencia_letras_numeros, pdf_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [departmentInfo.id_departamento, departmentInfo.id_municipio, departmentInfo.id_zona, departmentInfo.id_puesto, mesaInfo.numero, party.id_partido, votos_pdf, votos_sitio, diferencia, votos_en_letras, inconsistencia, mesaInfo.nombre_archivo]
                 );
            } else {
                await pool.query(
                    `UPDATE elecciones_actas_pdf SET votos_pdf = ?, votos_sitio = ?, diferencia_entre_sitio = ?, votos_en_letras = ?, inconsistencia_letras_numeros = ?, pdf_url = ? WHERE id = ?`,
                    [votos_pdf, votos_sitio, diferencia, votos_en_letras, inconsistencia, mesaInfo.nombre_archivo, existing[0].id]
                );
            }
        }
    } catch (error) {
        console.error(`      Failed to process PDF for mesa ${mesaInfo.numero}. URL: ${mesaInfo.nombre_archivo}. Error: ${error.message}`);
    }
}

const syncActas = async (req, res) => {
    res.status(202).send('Acta PDF synchronization process started. This is a very long process, check server logs for progress.');

    (async () => {
        try {
            console.log('--- Starting full synchronization of Acta PDFs ---');
            const [partyList] = await pool.query('SELECT DISTINCT parpo_id as id_partido, parpo_nombre as partido_nombre FROM elecciones_resultados');
            const [departamentos] = await pool.query('SELECT id_departamento FROM elecciones_departamentos ORDER BY id_departamento ASC');

            for (const depto of departamentos) {
                const { id_departamento } = depto;
                console.log(`Processing Department: ${id_departamento}`);
                const [municipios] = await pool.query('SELECT id_municipio FROM elecciones_municipios WHERE dpto = ? ORDER BY id_municipio ASC', [id_departamento]);

                for (const muni of municipios) {
                    const { id_municipio } = muni;
                    console.log(`  Processing Municipio: ${id_municipio}`);
                    const [zonas] = await pool.query('SELECT id_zona FROM elecciones_zonas ORDER BY id_zona ASC');
                    
                    for (const zona of zonas) {
                        const { id_zona } = zona;
                        const [puestos] = await pool.query('SELECT id_puesto FROM elecciones_puestos WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? ORDER BY id_puesto ASC', [id_departamento, id_municipio, id_zona]);

                        for (const puesto of puestos) {
                            const { id_puesto } = puesto;
                            const url = `https://resultadosgenerales2025-api.cne.hn/esc/v1/actas-documentos/01/${id_departamento}/${id_municipio}/${id_zona}/${id_puesto}/mesas`;
                            
                            try {
                                const response = await axios.get(url);
                                const mesas = response.data;
                                if (mesas && mesas.length > 0) {
                                    console.log(`    Found ${mesas.length} mesas for puesto ${id_puesto}. Processing...`);
                                    for (const mesa of mesas) {
                                        const departmentInfo = { id_departamento, id_municipio, id_zona, id_puesto };
                                        await processActaPDF(mesa, departmentInfo, partyList);
                                    }
                                }
                            } catch (error) {
                                if (error.response && error.response.status === 404) {
                                    // This is ok, not all puestos will have mesas
                                } else {
                                    console.error(`    Error fetching mesas for puesto ${id_puesto}: ${error.message}`);
                                }
                            }
                        }
                    }
                }
            }
            console.log('--- Full Acta PDF synchronization finished. ---');
        } catch (error) {
            console.error('A critical error occurred during the Acta PDF sync loop:', error);
        }
    })();
};

module.exports = {
    syncActas,
};
