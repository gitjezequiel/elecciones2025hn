const express = require('express');
const router = express.Router();
const resultadosController = require('../controller/resultadosController');

router.post('/sync-mesa', resultadosController.syncResultadosPorMesa);
router.post('/resume-sync-mesa', resultadosController.resumeSyncResultadosPorMesa);

// Add the other routes from index.js
router.post('/', resultadosController.postResultados);
router.get('/sync-all', resultadosController.syncAllDepartamentosResultados);
router.get('/departamento/:deptoId', resultadosController.getLatestDepartmentResults);

module.exports = router;
