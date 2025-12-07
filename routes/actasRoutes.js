const express = require('express');
const router = express.Router();
const actasController = require('../controller/actasController');

router.post('/sync', actasController.syncActas);

module.exports = router;
