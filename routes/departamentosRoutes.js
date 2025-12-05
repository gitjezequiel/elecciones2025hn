const express = require('express');
const router = express.Router();
const { getAllDepartamentos } = require('../controller/departamentosController');

router.get('/', getAllDepartamentos);

module.exports = router;
