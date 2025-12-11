const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const pool = require('../db');
const axios = require('axios');
const FormData = require('form-data');
const { reviewOcrResults } = require('../Servicios/gemini-service'); // Importación correcta

// --- Helper Functions for OCR Processing ---

const wordToNumberMap = {
    'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
    'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
    // Abreviaturas y errores comunes de OCR en español
    'yno': 1, 'una': 1, 'sets': 7, 'itres': 3, 'uro': 1, 'sieto': 7, 'doce': 2
};

/**
 * Parses a single line of text for vote counts, prioritizing word parsing.
 * @param {string} text The line of text to parse.
 * @returns {{finalValue: number, needsReview: boolean, rawValue: string}}
 */
function parseVoteWords(text) {
    const sanitizedText = text.toLowerCase()
        .replace(/[.,;:]/g, '') // Quitar puntuación
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos/tildes
        .trim();

    // 1. Extracción por Palabras (El método más robusto contra el espaciado)
    const numberWordsPattern = Object.keys(wordToNumberMap).join('|');
    const wordRegex = new RegExp(`(${numberWordsPattern})`, 'g');
    const wordsFound = sanitizedText.match(wordRegex);

    if (wordsFound && wordsFound.length >= 2) {
        // Intentar construir el número con las primeras 3 palabras encontradas
        const valueString = wordsFound.slice(0, 3).map(word => wordToNumberMap[word]).join('');
        if (valueString.length >= 2) {
             const finalValue = parseInt(valueString, 10);
             // Si el valor es de 2 o 3 dígitos y es razonable (< 500), se considera de alta confianza.
             if (finalValue < 500) {
                 return { finalValue: finalValue, needsReview: false, rawValue: `WORDS: ${wordsFound.join(' ').toUpperCase()}` };
             }
        }
    }
    
    // 2. Extracción por Dígitos (Fallback)
    // Buscamos 2 o 3 dígitos agrupados al final de la línea.
    const digitRegex = /(\d)\s*(\d)\s*(\d)$|(\d\d\d)$|(\d\s*\d)$|(\d\d)$/;
    const digitMatches = sanitizedText.match(digitRegex);
    if (digitMatches) {
        const value = parseInt(digitMatches.slice(1).filter(d => d).join('').replace(/\s/g, ''), 10);
        // Si encontramos un dígito, se usa como una "mejor suposición" pero se marca para revisión
        if (!isNaN(value)) {
             return { finalValue: value, needsReview: true, rawValue: `DIGITS: ${digitMatches[0].trim()}` };
        }
    }
    
    // 3. Fallback: Necesita Revisión con 0 como valor temporal
    return { finalValue: 0, needsReview: true, rawValue: 'UNPARSABLE' };
}

/**
 * Parses the full OCR response, relying on fixed order due to Acta structure.
 * @param {*} ocrData The raw data from the OCR API.
 * @returns {{votes: object, needsReview: boolean}}
 */
function parseOcrResponse(ocrData) {
    let rawText;
    let anyNeedsReview = false;
    const finalResults = {};
    const partyCodes = ['0001', '0002', '0003', '0004', '0005']; // Los primeros 5 partidos en orden fijo

    // Asegura que rawText sea una cadena válida
    if (ocrData && typeof ocrData.text === 'object' && ocrData.text !== null && typeof ocrData.text.text === 'string') {
        rawText = ocrData.text.text;
    } else if (ocrData && typeof ocrData.text === 'string') {
        rawText = ocrData.text;
    } else {
        console.warn('Warning: No text found in OCR response.');
        return { votes: {}, needsReview: true };
    }

    const lines = rawText.toUpperCase().split('\n');
    const voteLines = [];
    let startCounting = false;
    let endCounting = false;

    // 1. Identificar las líneas de resultados
    for (const line of lines) {
        const normalizedLine = line.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

        if (normalizedLine.includes('VOTOS EN NUMEROS EN LETRAS')) {
            startCounting = true;
            continue;
        }
        
        if (normalizedLine.includes('VOTOS EN BLANCO') || normalizedLine.includes('VOTOS NULOS') || normalizedLine.includes('GRAN TOTAL') || normalizedLine.includes('CARGO NOMBRES Y APELLIDOS')) {
             if (startCounting && !endCounting) {
                endCounting = true;
             }
        }
        
        if (startCounting && !endCounting) {
            // Asumiendo que las líneas de partido son las únicas que quedan
            if (normalizedLine.trim().length > 10) { // Filtra líneas vacías o muy cortas
                voteLines.push(line); 
            }
        }
    }

    // 2. Asignar votos basándose en el orden fijo de las líneas
    for (let i = 0; i < partyCodes.length; i++) {
        const partyCode = partyCodes[i];
        
        if (i < voteLines.length) {
            const line = voteLines[i];
            const parsedResult = parseVoteWords(line);
            finalResults[partyCode] = parsedResult;
            if (parsedResult.needsReview) {
                anyNeedsReview = true;
            }
        } else {
            // Si el OCR no detectó suficientes líneas de partido, necesitamos revisar
            finalResults[partyCode] = { finalValue: 0, needsReview: true, rawValue: 'LINE_MISSING' };
            anyNeedsReview = true;
        }
    }

    console.log("--- Resumen de Votos (Pre-Revisión) ---");
    for (const partyCode in finalResults) {
        if (Object.hasOwnProperty.call(finalResults, partyCode)) {
            const { finalValue, needsReview, rawValue } = finalResults[partyCode];
            console.log(
                `Partido ${partyCode}: ${finalValue} votos (Source: \"${rawValue}\", Review?: ${needsReview})`
            );
        }
    }
    
    return {
        votes: finalResults,
        needsReview: anyNeedsReview
    };
}

// ... [La función generateSql queda igual, ya que solo recibe finalVotes] ...
function generateSql(votes, depto, municipio, zona, puesto, mesa) {
    const values = Object.keys(votes).map(partyCode => {
        const voteCount = votes[partyCode].finalValue; 
        return `('${depto}','${municipio}','${zona}','${puesto}','${mesa}','${partyCode}',${voteCount})`;
    });

    if (values.length === 0) return null;

    return `INSERT INTO elecciones_actas_pdf (id_departamento,id_municipio,id_zona,id_puesto,id_mesa,id_partido,votos_pdf) VALUES ${values.join(',')};
`;
}

// ... [La función getFiles queda igual] ...
async function getFiles(dir) {
    const dirents = await fsp.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}


// --- Main Controller ---

const processActas = async (req, res) => {
    try {
        console.log('Starting to process actas...');
        const actasDir = path.join(__dirname, '..', 'actas_pdfs');
        const allFiles = await getFiles(actasDir);
        const pdfFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.pdf');

        console.log(`Found ${pdfFiles.length} PDF files to process.`);

        if (pdfFiles.length > 0) {
            let successCount = 0;
            let errorCount = 0;

            for (const pdfPath of pdfFiles) {
                try {
                    console.log(`\nProcessing file: ${pdfPath}`);

                    const filename = path.basename(pdfPath, '.pdf');
                    const parts = filename.split('_');
                    
                    if (parts.length < 8) {
                        console.error(`Invalid filename format: ${filename}.pdf. Skipping.`);
                        errorCount++;
                        continue;
                    }

                    const id_departamento = parts[2];
                    const id_municipio = parts[3];
                    const id_zona_raw = parts[4];
                    const id_puesto = parts[6];
                    const id_mesa = parts[7];
                    const id_zona = id_zona_raw.startsWith('0') ? id_zona_raw.substring(1) : id_zona_raw;

                    // 1. Verificar si el acta ya existe
                    const checkSql = `
                        SELECT COUNT(*) as count 
                        FROM elecciones_actas_pdf 
                        WHERE id_departamento = ? AND id_municipio = ? AND id_zona = ? AND id_puesto = ? AND id_mesa = ?
                    `;
                    const [rows] = await pool.execute(checkSql, [id_departamento, id_municipio, id_zona, id_puesto, id_mesa]);
                    
                    if (rows[0].count > 0) {
                        console.log(`Acta ${id_departamento}-${id_municipio}-${id_zona}-${id_puesto}-${id_mesa} already exists. Skipping.`);
                        continue;
                    }

                    // 2. Llamar al servicio OCR (TagGun)
                    const formData = new FormData();
                    formData.append('file', fs.createReadStream(pdfPath));
                    // ... (rest of form data)
                    
                    const url = 'https://api.taggun.io/api/receipt/v1/verbose/file';
                    const options = {
                        method: 'POST',
                        headers: { 
                            ...formData.getHeaders(), 
                            'apikey': process.env.TAGGUN_API_KEY // ¡Usar variable de entorno!
                        },
                        data: formData,
                        timeout: 30000
                    };

                    const ocrResponse = await axios(url, options);
                    const rawOcrText = ocrResponse.data.text ? ocrResponse.data.text.text || '' : '';
                    
                    // 3. Procesamiento local
                    const parsedData = parseOcrResponse(ocrResponse.data);
                    let finalVotes = parsedData.votes;

                    // 4. Validación por Gemini si es necesario
                    if (parsedData.needsReview) {
                        console.log('--- Inconsistent data found, initiating Gemini review as a last resort ---');
                        
                        // Capturamos la respuesta JSON de Gemini
                        const reviewedVotes = await reviewOcrResults(rawOcrText, finalVotes); 
                        console.log('--- Gemini review completed ---');
                        
                        // Actualizamos los votos solo con los valores que Gemini pudo corregir
                        for(const partyCode in reviewedVotes) {
                            if(finalVotes[partyCode] && typeof reviewedVotes[partyCode].finalValue === 'number') {
                                finalVotes[partyCode].finalValue = reviewedVotes[partyCode].finalValue;
                            }
                        }
                    } else {
                        console.log('--- OCR results are consistent, skipping Gemini review ---');
                    }

                    // 5. Inserción en la base de datos
                    const sql = generateSql(finalVotes, id_departamento, id_municipio, id_zona, id_puesto, id_mesa);
                        
                    if (sql) {
                        console.log('Insertando en MySQL...');
                        await pool.execute(sql);
                        const actaNumber = `${id_departamento}-${id_municipio}-${id_zona}-${id_puesto}-${id_mesa}`;
                        console.log(`Acta numero ${actaNumber} del archivo ${path.basename(pdfPath)} insertada exitosamente.`);
                        successCount++;
                    } else {
                        console.log(`No data to insert for file ${path.basename(pdfPath)}`);
                    }

                } catch (fileError) {
                    console.error(`Failed to process file ${path.basename(pdfPath)}:`, fileError.response ? fileError.response.data : fileError.message);
                    errorCount++;
                }
            }

            res.status(200).json({
                message: 'Processing complete.',
                totalFiles: pdfFiles.length,
                successful: successCount,
                failed: errorCount
            });

        } else {
            res.status(404).json({ message: 'No PDF files found in actas_pdfs directory.' });
        }

    } catch (error) {
        console.error('Error in processActas:', error.message);
        res.status(500).json({ error: 'Failed to process actas' });
    }
};

module.exports = {
    processActas
};