const express = require('express');
const router = express.Router();
const {
    getActasPdf,
    getActasPdfByDepartamento,
    getActasPdfByMunicipio,
    getActasPdfByZona,
    getActasPdfByPuesto,
    getActasPdfByMesa,
    getActasPdfByPartido
} = require('../controller/eleccionesActasPdfController');

router.get('/', getActasPdf);
router.get('/departamento', getActasPdfByDepartamento);
router.get('/municipio', getActasPdfByMunicipio);
router.get('/zona', getActasPdfByZona);
router.get('/puesto', getActasPdfByPuesto);
router.get('/mesa', getActasPdfByMesa);
router.get('/partido', getActasPdfByPartido);

module.exports = router;
