const express = require('express');
const router = express.Router();
const mesasController = require('../controller/mesasController');

router.post('/sync', mesasController.syncMesas);

module.exports = router;
