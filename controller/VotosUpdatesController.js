const pool = require('../db');

const getAllVotosUpdates = async (req, res) => {
    console.log('Processing request for all votes updates...');
    try {
        const [rows] = await pool.query('SELECT * FROM elecciones_votos_updates');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching all votes updates:', error);
        res.status(500).json({ message: 'Error fetching votes updates data.' });
    }
};

module.exports = {
    getAllVotosUpdates
};
