const pool = require('../db');

const getActasPdf = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM elecciones_actas_pdf');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching all actas pdf:', error);
        res.status(500).json({ message: 'Error fetching actas pdf data.' });
    }
};

const getActasPdfByDepartamento = async (req, res) => {
    try {
        const { id_departamento } = req.query;
        if (!id_departamento) {
            return res.status(400).json({ message: 'id_departamento parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_actas_pdf WHERE id_departamento = ?', [id_departamento]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching actas pdf by departamento:', error);
        res.status(500).json({ message: 'Error fetching actas pdf data.' });
    }
};

const getActasPdfByMunicipio = async (req, res) => {
    try {
        const { id_municipio } = req.query;
        if (!id_municipio) {
            return res.status(400).json({ message: 'id_municipio parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_actas_pdf WHERE id_municipio = ?', [id_municipio]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching actas pdf by municipio:', error);
        res.status(500).json({ message: 'Error fetching actas pdf data.' });
    }
};

const getActasPdfByZona = async (req, res) => {
    try {
        const { id_zona } = req.query;
        if (!id_zona) {
            return res.status(400).json({ message: 'id_zona parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_actas_pdf WHERE id_zona = ?', [id_zona]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching actas pdf by zona:', error);
        res.status(500).json({ message: 'Error fetching actas pdf data.' });
    }
};

const getActasPdfByPuesto = async (req, res) => {
    try {
        const { id_puesto } = req.query;
        if (!id_puesto) {
            return res.status(400).json({ message: 'id_puesto parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_actas_pdf WHERE id_puesto = ?', [id_puesto]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching actas pdf by puesto:', error);
        res.status(500).json({ message: 'Error fetching actas pdf data.' });
    }
};

const getActasPdfByMesa = async (req, res) => {
    try {
        const { id_mesa } = req.query;
        if (!id_mesa) {
            return res.status(400).json({ message: 'id_mesa parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_actas_pdf WHERE id_mesa = ?', [id_mesa]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching actas pdf by mesa:', error);
        res.status(500).json({ message: 'Error fetching actas pdf data.' });
    }
};

const getActasPdfByPartido = async (req, res) => {
    try {
        const { id_partido } = req.query;
        if (!id_partido) {
            return res.status(400).json({ message: 'id_partido parameter is required.' });
        }
        const [rows] = await pool.query('SELECT * FROM elecciones_actas_pdf WHERE id_partido = ?', [id_partido]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching actas pdf by partido:', error);
        res.status(500).json({ message: 'Error fetching actas pdf data.' });
    }
};

module.exports = {
    getActasPdf,
    getActasPdfByDepartamento,
    getActasPdfByMunicipio,
    getActasPdfByZona,
    getActasPdfByPuesto,
    getActasPdfByMesa,
    getActasPdfByPartido
};
