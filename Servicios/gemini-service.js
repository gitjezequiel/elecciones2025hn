// gemini-service.js

const axios = require('axios'); 
const GEMINI_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

async function reviewOcrResults(rawOcrText, finalVotes) {
    const partyMapping = {
        '0001': 'PARTIDO 1',
        '0002': 'PARTIDO 2',
        '0003': 'PARTIDO 3',
        '0004': 'PARTIDO 4',
        '0005': 'PARTIDO 5'
    };
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    // ... (Tu console.log de verificación) ...
    
    const GEMINI_API_URL_FINAL = `${GEMINI_API_URL_BASE}?key=${apiKey}`;
    
    let preliminaryData = "";
    for (const code in finalVotes) {
        if (finalVotes[code].needsReview) {
            // Saneamos la data preliminar
            const sanitizedRawValue = finalVotes[code].rawValue.replace(/"/g, "'").replace(/\n/g, ' ');
            preliminaryData += `${code} (${partyMapping[code]}): Valor extraído: ${finalVotes[code].finalValue} (Basado en: ${sanitizedRawValue})\n`;
        }
    }

    if (preliminaryData === "") {
        console.log("Advertencia: No se encontraron valores que requieran revisión. No se envió el prompt.");
        return {};
    }

    // Saneamiento del texto OCR (Solución del error 400 por suciedad de texto)
    const sanitizedOcrText = rawOcrText
        .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "") 
        .replace(/\\/g, '\\\\') 
        .trim();

    // 4. Construir el prompt coercitivo
    const prompt = `Eres un Experto en Validación de Actas Electorales (CNE). Tu función es revisar el texto bruto extraído por OCR y validar los recuentos de votos de los partidos.

El acta sigue un orden estricto de los primeros cinco partidos en la sección de resultados.

***DATOS PRELIMINARES PARA VALIDAR (Valores Inconsistentes según el OCR):***
${preliminaryData}

***TEXTO BRUTO DEL ACTA (OCR):***
--- INICIO DEL TEXTO ---
${sanitizedOcrText}
--- FIN DEL TEXTO ---

***INSTRUCCIONES DE SALIDA:***
1. Busca la sección 'II. RESULTADOS DEL ESCRUTINIO' en el TEXTO BRUTO.
2. Extrae el valor numérico (VOTOS EN NÚMEROS) exacto para los primeros cinco partidos políticos, siguiendo el orden en el que aparecen en el texto (0001 al 0005).
3. Tu respuesta debe ser estricta y únicamente un objeto JSON con la siguiente estructura, sin ninguna otra explicación, prefijo o texto introductorio. Los valores deben ser NÚMEROS ENTEROS.

\`\`\`json
{
  "0001": {"finalValue": [Voto correcto para el Partido 1]},
  "0002": {"finalValue": [Voto correcto para el Partido 2]},
  "0003": {"finalValue": [Voto correcto para el Partido 3]},
  "0004": {"finalValue": [Voto correcto para el Partido 4]},
  "0005": {"finalValue": [Voto correcto para el Partido 5]}
}
\`\`\`
***NOTA:*** Si el valor es ilegible en el TEXTO BRUTO, usa **-1**.
`;


    try {
        const geminiResponse = await axios.post(GEMINI_API_URL_FINAL, {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            
        }, {
            headers: { 
                'Content-Type': 'application/json' 
            }
        });
        
        // Manejo de la respuesta
        const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
        
        // Limpiamos la respuesta JSON del formato Markdown (```json ... ```)
        const cleanedText = responseText.replace(/```json|```/g, '').trim();
        const reviewedVotes = JSON.parse(cleanedText);
        
        return reviewedVotes;

    } catch (error) {
        console.error("Error al llamar a Gemini:", error.response ? `Request failed with status code ${error.response.status}` : error.message);
        return finalVotes;
    }
}

module.exports = { reviewOcrResults };