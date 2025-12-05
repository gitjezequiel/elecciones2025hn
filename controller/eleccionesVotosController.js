const pool = require('../db');

const getVotos = async (req, res) => {
    console.log('Processing request for all votes...');
    try {
        const [rows] = await pool.query('SELECT * FROM elecciones_votos_updates');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching all votes:', error);
        res.status(500).json({ message: 'Error fetching votes data.' });
    }
};

const getVotosByActa = async (req, res) => {
    console.log('Processing request for votes by acta...');
    try {
        const { acta } = req.query;
        if (!acta) {
            return res.status(400).json({ message: 'Acta parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_votos WHERE acta = ?', [acta]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching votes by acta:', error);
        res.status(500).json({ message: 'Error fetching votes data.' });
    }
};

const getVotosByMunicipio = async (req, res) => {
    console.log('Processing request for votes by municipio...');
    try {
        const { municipio_id } = req.query;
        if (!municipio_id) {
            return res.status(400).json({ message: 'Municipio ID parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_votos WHERE municipio_id = ?', [municipio_id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching votes by municipio:', error);
        res.status(500).json({ message: 'Error fetching votes data.' });
    }
};

const getVotosByDepartamento = async (req, res) => {
    console.log('Processing request for votes by departamento...');
    try {
        const { departamento_id } = req.query;
        if (!departamento_id) {
            return res.status(400).json({ message: 'Departamento ID parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_votos WHERE departamento_id = ?', [departamento_id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching votes by departamento:', error);
        res.status(500).json({ message: 'Error fetching votes data.' });
    }
};

module.exports = {
    getVotos,
    getVotosByActa,
    getVotosByMunicipio,
    getVotosByDepartamento
};
