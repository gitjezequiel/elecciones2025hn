require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configure the Gemini model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

/**
 * Reviews OCR results with Gemini when the primary parsing methods fail.
 * @param {string} ocrText The raw text extracted from the OCR process.
 * @param {object} parsedVotes The structured data, where some items need review.
 * @returns {Promise<object>} A promise that resolves to the reviewed and corrected vote data.
 */
async function reviewOcrResults(ocrText, parsedVotes) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    console.warn('GEMINI_API_KEY not found or not configured in .env file. Skipping Gemini review.');
    return parsedVotes; // Return the best-effort guess
  }

  try {
    const prompt = `
      Eres un asistente experto en el análisis de documentos electorales (Actas de Escrutinio).
      El sistema automatizado ha procesado el siguiente texto de un Acta de Cierre de CNE 2025.
      Sin embargo, para algunos partidos, no pudo determinar con confianza la cantidad de votos
      (es decir, no encontró ni tres dígitos numéricos ni tres palabras numéricas claras en la línea correspondiente).

      Tu tarea es analizar el "Texto Original del OCR" y, **SOLO PARA LOS PARTIDOS MARCADOS CON "needsReview": true**,
      identificar y extraer el número de votos asociado a ese partido (buscando en la columna "VOTOS EN NÚMEROS").

      Texto Original del OCR:
      ---
      ${ocrText}
      ---
      
      Análisis del Sistema (Mejor Intento, incluyendo los que necesitan revisión):
      ---
      ${JSON.stringify(parsedVotes, null, 2)}
      ---

      Instrucciones:
      1.  Enfócate en la sección "II. RESULTADOS DEL ESCRUTINIO" del "Texto Original del OCR".
      2.  Para cada partido en el "Análisis del Sistema" donde "needsReview" sea 'true', busca su correspondiente línea en el "Texto Original del OCR".
      3.  De esa línea, extrae el valor numérico de "VOTOS EN NÚMEROS". Este será el "finalValue" corregido.
      4.  Responde **SOLAMENTE con un objeto JSON**. La clave de cada entrada debe ser el código del partido (e.g., "0001", "0002", etc.) y el valor debe ser un objeto que contenga únicamente el campo "finalValue" con el número de votos que determinaste.
      5.  Si para un partido marcado como "needsReview: true" no puedes encontrar un valor claro, establece su "finalValue" a 0.

      Ejemplo de Respuesta Esperada (solo el JSON):
      {
        "0001": { "finalValue": 123 },
        "0002": { "finalValue": 45 },
        "0003": { "finalValue": 6 },
        "0004": { "finalValue": 78 },
        "0005": { "finalValue": 90 }
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    console.log('--- Respuesta de Gemini ---');
    console.log(cleanedText);
    console.log('-------------------------');

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error during Gemini API call:', error);
    // If Gemini fails, return the original parsed votes to not stop the process.
    return parsedVotes;
  }
}

module.exports = { reviewOcrResults };