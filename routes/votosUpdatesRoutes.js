const express = require('express');
const router = express.Router();
const { getAllVotosUpdates } = require('../controller/VotosUpdatesController');

router.get('/', getAllVotosUpdates);

module.exports = router;
