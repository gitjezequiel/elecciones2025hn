const express = require('express');
const router = express.Router();
const { getMunicipiosByDepartamento } = require('../controller/municipiosController');

router.get('/:deptoId', getMunicipiosByDepartamento);

module.exports = router;
