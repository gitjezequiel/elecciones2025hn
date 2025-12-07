const express = require('express');
const router = express.Router();
const puestosController = require('../controller/puestosController');

router.post('/sync', puestosController.syncPuestos);

module.exports = router;
