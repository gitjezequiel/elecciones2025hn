const axios = require('axios');
const pdf = require('pdf-parse');
const { fromBuffer } = require('pdf2pic');        // usa pdf2pic v3+
const cv = require('opencv4nodejs');
const fs = require('fs');
const path = require('path');

function cargarTemplates(carpeta = './banderas') {
  const templates = {};
  fs.readdirSync(carpeta).forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;
    const nombre = path.parse(file).name.toUpperCase(); // DC, LIBRE, PINU, LIBERAL, NACIONAL
    templates[nombre] = cv.imread(path.join(carpeta, file));
  });
  return templates;
}

async function procesarActaDesdeUrl(url) {
  const templates = cargarTemplates();

  // 1) Descargar PDF
  const resp = await axios.get(url, { responseType: 'arraybuffer' });
  const pdfBuffer = Buffer.from(resp.data);

  // 2) Texto -> filas con 3 dígitos
  const data = await pdf(pdfBuffer);
  const texto = data.text.toUpperCase();
  const regex = /(\b[ A-ZÁÉÍÓÚÑ]{2,20}\b)\s+(\d)\s+(\d)\s+(\d)/g;
  const filas = [];
  let m;
  while ((m = regex.exec(texto)) !== null) {
    const numeroStr = `${m[2]}${m[3]}${m[4]}`;
    filas.push({
      etiquetaTexto: m[1].trim(),
      digitos: numeroStr,
      votos: parseInt(numeroStr, 10) || 0
    });
  }

  // 3) PDF -> imagen (página 1)
  const convert = fromBuffer(pdfBuffer, { density: 300 });
  const page = await convert(1, { responseType: 'buffer' });
  const img = cv.imdecode(page.buffer);

  // 4) Detectar banderas en 5 filas
  const alturaFila = img.rows / 12;
  const anchoLogo = img.cols * 0.12;
  const resultados = [];

  for (let i = 0; i < 5; i++) {
    const y = Math.floor(alturaFila * (3 + i * 2.2));
    const x = 60;
    const roi = img.getRegion(
      new cv.Rect(x, y, Math.floor(anchoLogo), Math.floor(alturaFila * 1.2))
    );

    let mejor = { partido: 'NO_DETECTADA', score: 0 };

    for (const [nombre, tpl] of Object.entries(templates)) {
      if (tpl.rows > roi.rows || tpl.cols > roi.cols) continue;
      const res = roi.matchTemplate(tpl, cv.TM_CCOEFF_NORMED);
      const { maxVal } = res.minMaxLoc();
      if (maxVal > 0.7 && maxVal > mejor.score) {
        mejor = { partido: nombre, score: maxVal };
      }
    }

    const filaTexto = filas[i] || {};
    resultados.push({
      ordenFila: i + 1,
      partidoImagen: mejor.partido,          // DC, LIBRE, PINU, LIBERAL, NACIONAL
      confianzaImagen: mejor.score.toFixed(3),
      etiquetaTexto: filaTexto.etiquetaTexto || '?',
      digitos: filaTexto.digitos || '000',
      votos: filaTexto.votos || 0
    });
  }

  console.table(resultados);
  return resultados;
}

// Uso:
procesarActaDesdeUrl('TU_URL_DEL_PDF');
