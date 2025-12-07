const express = require('express');
const resultadosController = require('./controller/resultadosController');
const departamentosController = require('./controller/departamentosController');
const municipiosVotosController = require('./controller/municipiosVotosController');
const departamentosRoutes = require('./routes/departamentosRoutes');
const municipiosRoutes = require('./routes/municipiosRoutes');
const votosUpdatesRoutes = require('./routes/votosUpdatesRoutes');
const eleccionesVotosRoutes = require('./routes/eleccionesVotosRoutes');
const eleccionesMunicipiosRoutes = require('./routes/eleccionesMunicipiosRoutes');
const puestosRoutes = require('./routes/puestosRoutes');
const mesasRoutes = require('./routes/mesasRoutes');

const app = express();
const port = 3000;

app.use(express.json());
// Middleware to log every request
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// --- API Routes ---
app.use('/api/departamentos', departamentosRoutes);
app.use('/api/municipios', municipiosRoutes);
app.use('/api/votos-updates', votosUpdatesRoutes);
app.use('/api/elecciones-votos', eleccionesVotosRoutes);
app.use('/api', eleccionesMunicipiosRoutes);
app.use('/api/puestos', puestosRoutes);
app.use('/api/mesas', mesasRoutes);

// --- SYNC ENDPOINTS (POST for triggering, GET for bulk) ---
app.post('/api/resultados', resultadosController.postResultados);
app.get('/api/resultados/sync-all', resultadosController.syncAllDepartamentosResultados);
app.post('/api/departamentos/sync', departamentosController.syncDepartamentos);
app.post('/api/municipios-votos/sync', municipiosVotosController.syncMunicipiosVotos);

// --- DATA-FETCHING ENDPOINTS (GET) ---
app.get('/api/resultados/departamento/:deptoId', resultadosController.getLatestDepartmentResults);
app.get('/api/resultados/municipio/:deptoId/:municipioId', municipiosVotosController.getLatestMunicipalResults);


app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
