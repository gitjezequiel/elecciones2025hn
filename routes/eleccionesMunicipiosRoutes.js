const express = require('express');
const router = express.Router();
const eleccionesMunicipiosController = require('../controller/eleccionesMunicipiosController');

router.post('/sync-elecciones-municipios', eleccionesMunicipiosController.syncEleccionesMunicipios);

module.exports = router;