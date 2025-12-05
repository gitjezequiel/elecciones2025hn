const express = require('express');
const { postResultados, syncAllDepartamentosResultados } = require('./controller/resultadosController');
const { syncDepartamentos } = require('./controller/departamentosController');
const { syncMunicipiosVotos } = require('./controller/municipiosVotosController'); // Import the new controller

const app = express();
const port = 3000;

app.use(express.json());

// Middleware para loggear cada peticion
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.post('/api/resultados', postResultados);
app.get('/api/resultados/sync-all', syncAllDepartamentosResultados);
app.post('/api/departamentos/sync', syncDepartamentos);
app.post('/api/municipios-votos/sync', syncMunicipiosVotos); // Add the new route

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});