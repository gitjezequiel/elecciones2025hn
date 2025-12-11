const express = require('express');
const router = express.Router();
const { descargarActa, descargarActasFaltantes } = require('../controller/actasDescargaController.js');

// Route for downloading a single, specific acta
router.post('/descargar-acta', descargarActa);

// Route for triggering a background sync to download all missing actas
router.post('/sync', descargarActasFaltantes);

module.exports = router;
