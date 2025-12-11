const express = require('express');
const router = express.Router();
const ocrController = require('../controller/ocrController');

router.post('/process-actas', ocrController.processActas);

module.exports = router;