const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PDF_ROOT_DIR = path.join(__dirname, '..', 'actas_pdfs');
const API_BASE_URL = 'https://resultadosgenerales2025-api.cne.hn/esc/v1/actas-documentos/01';

// This version throws an error, suitable for single-file downloads where the user gets a response.
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
        console.error(`Error downloading ${url}: ${error.message}`);
        throw error; // Re-throw to be caught by the controller
    }
}

const descargarActa = async (req, res) => {
    const { id_departamento, id_municipio, id_zona, id_puesto, id_mesa } = req.body;

    if (!id_departamento || !id_municipio || !id_zona || !id_puesto || !id_mesa) {
        return res.status(400).json({ message: 'Missing required parameters: id_departamento, id_municipio, id_zona, id_puesto, id_mesa' });
    }

    const apiUrl = `${API_BASE_URL}/${id_departamento}/${id_municipio}/${id_zona}/${id_puesto}/mesas`;

    try {
        console.log(`Fetching data from: ${apiUrl}`);
        const { data: mesas } = await axios.get(apiUrl);

        if (!Array.isArray(mesas) || mesas.length === 0) {
            return res.status(404).json({ message: `No 'mesas' found for the specified location.` });
        }

        // The user wants to filter by mesa, but the API seems to return all mesas for a puesto.
        // The user might send 'id_mesa' as a string, let's make sure we compare correctly.
        const mesaInfo = mesas.find(m => String(m.id_mesa) === String(id_mesa));

        if (!mesaInfo) {
            return res.status(404).json({ message: `Mesa ${id_mesa} not found at the specified location.` });
        }

        const pdfUrl = mesaInfo.nombre_archivo;
        if (!pdfUrl) {
            return res.status(404).json({ message: "Mesa found but does not have a 'nombre_archivo'." });
        }

        const urlParts = new URL(pdfUrl);
        const filename = path.basename(urlParts.pathname);
        
        const saveDir = path.join(PDF_ROOT_DIR, id_departamento, id_municipio, id_zona, id_puesto);
        fs.mkdirSync(saveDir, { recursive: true });
        
        const savePath = path.join(saveDir, filename);

        if (fs.existsSync(savePath)) {
            console.log(`File already exists: ${savePath}`);
            return res.status(200).json({ message: 'File already exists', path: savePath });
        }

        console.log(`Downloading ${filename} to ${saveDir}`);
        await downloadFile(pdfUrl, savePath);

        res.status(201).json({ message: 'File downloaded successfully', path: savePath });

    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ message: `No data found for URL (404): ${apiUrl}` });
        }
        console.error(`Failed to process request. Error: ${error.message}`);
        res.status(500).json({ message: 'An unexpected error occurred' });
    }
};

const descargarActasFaltantes = (req, res) => {
    // Immediately respond to the client
    res.status(202).json({ message: "Accepted: Background process to download missing 'actas' has been started by executing 'descargar-actas.js'." });

    console.log("Spawning 'descargar-actas.js' script...");
    const scriptPath = path.join(__dirname, '..', 'descargar-actas.js');
    const child = spawn('node', [scriptPath]);

    child.stdout.on('data', (data) => {
        console.log(`[descargar-actas.js]: ${data}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`[descargar-actas.js ERROR]: ${data}`);
    });

    child.on('close', (code) => {
        console.log(`'descargar-actas.js' script finished with code ${code}`);
    });

    child.on('error', (err) => {
        console.error("Failed to start 'descargar-actas.js' script.", err);
    });
};


module.exports = {
    descargarActa,
    descargarActasFaltantes,
};
