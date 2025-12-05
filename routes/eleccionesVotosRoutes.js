const express = require('express');
const router = express.Router();
const { getVotos, getVotosByActa, getVotosByMunicipio, getVotosByDepartamento } = require('../controller/eleccionesVotosController');

router.get('/', getVotos);
router.get('/acta', getVotosByActa);
router.get('/municipio', getVotosByMunicipio);
router.get('/departamento', getVotosByDepartamento);

module.exports = router;
