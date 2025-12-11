
const pool = require('./db.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const minimist = require('minimist'); // Import minimist

const args = minimist(process.argv.slice(2));

const startDept = args.startDept;
const startMun = args.startMun;
const startZona = args.startZona;
const startPuesto = args.startPuesto;

const PDF_ROOT_DIR = path.join(__dirname, 'actas_pdfs');
const API_BASE_URL = 'https://resultadosgenerales2025-api.cne.hn/esc/v1/actas-documentos/01';

async function downloadFile(url, savePath) {
    try {
        const writer = fs.createWriteStream(savePath);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        // Log network errors, but don't stop the whole process
        console.error(`Error downloading ${url}: ${error.message}`);
    }
}

async function fetchAndDownloadActas() {
    let connection;
    try {
        console.log('Fetching polling station data from the database...');
        connection = await pool.getConnection();
        const [puestos] = await connection.query(
            "SELECT DISTINCT id_departamento, id_municipio, id_zona, id_puesto FROM elecciones_puestos ORDER BY id_departamento, id_municipio, id_zona, id_puesto"
        );
        console.log(`Found ${puestos.length} unique polling stations to process.`);

        let startedProcessing = false;
        if (!startDept || !startMun || !startZona || !startPuesto) {
            startedProcessing = true; // If any start argument is missing, start immediately
            if (startDept || startMun || startZona || startPuesto) {
                console.log("Warning: Partial resume arguments provided. Starting from the beginning.");
            }
        } else {
            console.log(`Attempting to resume from: Departamento ${startDept}, Municipio ${startMun}, Zona ${startZona}, Puesto ${startPuesto}`);
        }


        for (const puesto of puestos) {
            const { id_departamento, id_municipio, id_zona, id_puesto } = puesto;

            if (!startedProcessing) {
                // Check if we reached the starting point
                if (id_departamento === startDept &&
                    id_municipio === startMun &&
                    id_zona === startZona &&
                    id_puesto === startPuesto) {
                    startedProcessing = true;
                    console.log(`Starting download from Departamento ${id_departamento}, Municipio ${id_municipio}, Zona ${id_zona}, Puesto ${id_puesto}`);
                } else {
                    console.log(`Skipping Departamento ${id_departamento}, Municipio ${id_municipio}, Zona ${id_zona}, Puesto ${id_puesto} (before start point)`);
                    continue; // Skip until we reach the starting point
                }
            }

            const apiUrl = `${API_BASE_URL}/${id_departamento}/${id_municipio}/${id_zona}/${id_puesto}/mesas`;

            try {
                console.log(`Fetching data from: ${apiUrl}`);
                const { data: mesas } = await axios.get(apiUrl);

                if (!Array.isArray(mesas) || mesas.length === 0) {
                    console.log(`No 'mesas' found for puesto ${id_puesto} in zona ${id_zona}.`);
                    continue;
                }

                for (const mesa of mesas) {
                    const pdfUrl = mesa.nombre_archivo;
                    if (!pdfUrl) {
                        console.log("Mesa found without 'nombre_archivo'. Skipping.");
                        continue;
                    }

                    // Extract filename from URL (e.g., E14_P01_01_001_001_00_001_001_0003.pdf)
                    const urlParts = new URL(pdfUrl);
                    const filename = path.basename(urlParts.pathname);
                    
                    const saveDir = path.join(PDF_ROOT_DIR, id_departamento, id_municipio, id_zona, id_puesto);
                    fs.mkdirSync(saveDir, { recursive: true });
                    
                    const savePath = path.join(saveDir, filename);

                    if (fs.existsSync(savePath)) {
                        console.log(`File already exists, skipping: ${savePath}`);
                        continue;
                    }

                    console.log(`Downloading ${filename} to ${saveDir}`);
                    await downloadFile(pdfUrl, savePath);
                }
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    console.log(`No data found for URL (404): ${apiUrl}`);
                } else {
                    console.error(`Failed to process ${apiUrl}. Error: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error('An unexpected error occurred:', error);
    } finally {
        if (connection) {
            console.log('Closing database connection.');
            connection.release();
        }
        // Since the pool was created in another module, that module should be responsible for closing it.
        // We only release the connection we acquired.
        // await pool.end(); // Avoid ending the pool here
        console.log('Finished processing all polling stations.');
    }
}

fetchAndDownloadActas();
