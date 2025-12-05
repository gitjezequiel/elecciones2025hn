const pool = require('../db');

const getVotosUpdates = async (req, res) => {
    console.log('Processing request for all votes updates...');
    try {
        const { departamento_id } = req.query;
        let query = 'SELECT * FROM elecciones_votos_updates';
        const params = [];

        if (departamento_id) {
            query += ' WHERE departamento_codigo = ?';
            params.push(departamento_id);
        }

        console.log(query)

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching all votes updates:', error);
        res.status(500).json({ message: 'Error fetching votes updates data.' });
    }
};

module.exports = {
    getVotosUpdates
};
