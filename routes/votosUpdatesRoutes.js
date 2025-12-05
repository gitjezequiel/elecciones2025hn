const express = require('express');
const router = express.Router();
const { getVotosUpdates } = require('../controller/VotosUpdatesController');

router.get('/', getVotosUpdates);

module.exports = router;
