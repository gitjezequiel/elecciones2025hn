const pool = require('../db');

const getMunicipiosByDepartamento = async (req, res) => {
    try {
        const { deptoId } = req.params;
        const [rows] = await pool.query('SELECT id_municipio as municipioId, nombre_municipio as nombre FROM elecciones_municipios WHERE id_departamento = ? ORDER BY nombre_municipio ASC', [deptoId]);
        res.json(rows);
    } catch (error) {
        console.error(`Error fetching municipios for department ${deptoId}:`, error);
        res.status(500).json({ message: 'Error fetching municipality data.' });
    }
};

module.exports = {
    getMunicipiosByDepartamento
};
