const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const pool = require('../db');
const axios = require('axios');
const FormData = require('form-data');

// --- Helper Functions for OCR Processing ---

const wordToNumberMap = {

    'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,

    'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,

    'yno': 1,  // Handle OCR error for "uno"

    'una': 1,  // Handle feminine form of "uno"

    'sets': 7,  // Handle OCR error for "siete"

    'itres': 3 // Handle OCR error for "tres"

};

// This function now uses a fallback mechanism if 3 number words are not found.
function parseVoteWords(text) {
    const sanitizedText = text.replace(/:/g, '');
    const numberWords = Object.keys(wordToNumberMap).join('|');
    const wordRegex = new RegExp(`\\b(${numberWords})\\b`, 'g');
    const words = sanitizedText.toLowerCase().match(wordRegex);

    // Primary Method: Use words if we find 3 of them.
    if (words && words.length === 3) {
        const digits = words.map(word => wordToNumberMap[word]);
        const value = parseInt(digits.join(''), 10);
        return { value, rawWords: words.join(' ').toUpperCase() };
    }

    // Fallback Method: If fewer than 3 words, use the numerical digits.
    // This regex finds three single digits that can be separated by spaces.
    const digitRegex = /(\d)\s*(\d)\s*(\d)/g;
    const matches = [...sanitizedText.matchAll(digitRegex)];
    
    // Use the last match in the line, as it's most likely the vote count.
    if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const value = parseInt(lastMatch[1] + lastMatch[2] + lastMatch[3], 10);
        const rawWordsText = words ? words.join(' ').toUpperCase() : 'N/A';
        return { value, rawWords: `${rawWordsText} (FALLBACK: ${lastMatch[0].trim()})` };
    }
    
    // If both methods fail, parse whatever words we got.
    if (words) {
        const digits = words.map(word => wordToNumberMap[word]);
        const value = parseInt(digits.join(''), 10);
        return { value, rawWords: words.join(' ').toUpperCase() };
    }

    return { value: 0, rawWords: 'N/A' };
}

// New function to parse text based on fixed order
function parseOcrResponse(ocrData) {
    let rawText;
    // Initialize with all parties.
    const finalResults = {
        '0001': { value: 0, rawWords: '' },
        '0002': { value: 0, rawWords: '' },
        '0003': { value: 0, rawWords: '' },
        '0004': { value: 0, rawWords: '' },
        '0005': { value: 0, rawWords: '' }
    };

    if (ocrData && typeof ocrData.text === 'object' && ocrData.text !== null && typeof ocrData.text.text === 'string') {
        rawText = ocrData.text.text;
    } else if (ocrData && typeof ocrData.text === 'string') {
        rawText = ocrData.text;
    } else {
        console.warn('Warning: No text found in OCR response or text is in an unexpected format.');
        return { votes: finalResults };
    }

    const lines = rawText.toUpperCase().split('\n');
    const voteLines = [];
    const numberWordsPattern = new RegExp(`\\b(${Object.keys(wordToNumberMap).join('|')})\\b`);
    let startCounting = false;

    // --- Find all potential party vote lines ---
    for (const line of lines) {
        const lineUpper = line.trim().toUpperCase();
        const normalizedLine = lineUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Check for the start signal before processing
        if (!startCounting) {
            if (normalizedLine.includes('VOTOS EN NUMEROS EN LETRAS')) {
                startCounting = true;
            }
            continue; // Skip until the start signal is found
        }
        
        // Ignore lines that are definitely not party results
        if (normalizedLine.includes('VOTOS EN BLANCO') || normalizedLine.includes('VOTOS NULOS') || normalizedLine.includes('GRAN TOTAL')) {
            continue;
        }

        // A potential vote line must contain number words
        if (numberWordsPattern.test(normalizedLine.toLowerCase())) {
            voteLines.push(lineUpper);
        }
    }

    // --- Assign votes based on fixed order ---
    // Take the first 5 qualifying lines and assign them sequentially.
    for (let i = 0; i < 5 && i < voteLines.length; i++) {
        const partyCode = `000${i + 1}`;
        const line = voteLines[i];
        const parsedResult = parseVoteWords(line);
        finalResults[partyCode] = parsedResult;
    }

    // Log all 5 parties and their final vote counts explicitly
    console.log("--- Resumen Final de Votos por Partido (Basado en Orden) ---");
    for (const partyCode in finalResults) {
        if (Object.hasOwnProperty.call(finalResults, partyCode)) {
            const { value, rawWords } = finalResults[partyCode];
            console.log(`Partido ${partyCode}: ${value} votos (raw: ${rawWords || 'N/A'})`);
        }
    }
    console.log("--- Finaliza Procesamiento de Votos ---");
    
    return {
        votes: finalResults
    };
}

function generateSql(votes, depto, municipio, zona, puesto, mesa) {
    const values = Object.keys(votes).map(partyCode => {
        // Ensure to use the 'value' property from the votes object
        const voteCount = votes[partyCode].value; 
        return `('${depto}','${municipio}','${zona}','${puesto}','${mesa}','${partyCode}',${voteCount})`;
    });

    if (values.length === 0) return null;

    return `INSERT INTO elecciones_actas_pdf (id_departamento,id_municipio,id_zona,id_puesto,id_mesa,id_partido,votos_pdf) VALUES ${values.join(',')};`;
}


// Recursive function to get all file paths in a directory
async function getFiles(dir) {
    const dirents = await fsp.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}

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
                    
                    const formData = new FormData();
                    formData.append('file', fs.createReadStream(pdfPath));
                    formData.append('extractLineItems', 'true');
                    formData.append('extractTime', 'false');
                    formData.append('refresh', 'false');
                    formData.append('incognito', 'false');

                    const url = 'https://api.taggun.io/api/receipt/v1/verbose/file';
                    const options = {
                        method: 'POST',
                        headers: {
                            ...formData.getHeaders(),
                            'apikey': '91773469116242a7af17e0030e837bb6'
                        },
                        data: formData,
                        timeout: 30000 // 30 second timeout
                    };

                    const ocrResponse = await axios(url, options);
                    
                    // The parsing function now handles all the required logging.
                    const parsedData = parseOcrResponse(ocrResponse.data);

                    // --- DB INSERTION DISABLED FOR VERIFICATION ---
                    const shouldInsert = true; // Set to true to re-enable DB insertion
                    if (shouldInsert) {
                         // --- Filename parsing logic ---
                        const filename = path.basename(pdfPath, '.pdf');
                        const parts = filename.split('_');
                        
                        if (parts.length < 8) {
                            console.error(`Invalid filename format: ${filename}.pdf. Skipping DB insert.`);
                            errorCount++;
                            continue;
                        }

                        const id_departamento = parts[2];
                        const id_municipio = parts[3];
                        const id_zona_raw = parts[4];
                        const id_puesto = parts[6];
                        const id_mesa = parts[7];
                        const id_zona = id_zona_raw.startsWith('0') ? id_zona_raw.substring(1) : id_zona_raw;

                        const sql = generateSql(parsedData.votes, id_departamento, id_municipio, id_zona, id_puesto, id_mesa);
                        
                        if (sql) {
                            console.log('Insertando en MySQL...');
                            const [result] = await pool.execute(sql);
                            const actaNumber = `${id_departamento}-${id_municipio}-${id_zona}-${id_puesto}-${id_mesa}`;
                            console.log(`Acta numero ${actaNumber} del archivo ${path.basename(pdfPath)} insertada exitosamente.`);
                            successCount++;
                        } else {
                            console.log(`No data to insert for file ${path.basename(pdfPath)}`);
                        }
                    } else {
                         console.log('DB insertion is currently disabled for verification.');
                         successCount++; // Mark as success for reporting purposes
                    }

                } catch (fileError) {
                    console.error(`Failed to process file ${path.basename(pdfPath)}:`, fileError.response ? fileError.response.data : fileError.message);
                    errorCount++;
                }
            }

            res.status(200).json({
                message: 'Verification processing complete. DB insertion was disabled.',
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