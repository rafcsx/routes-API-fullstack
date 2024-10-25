// src/middleware/auth.js

const API_KEY = 'b0d6972e-f3cf-4e0e-a9af-5403be4328c9';

const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key']; // Obter a chave da API dos cabeçalhos

    if (apiKey && apiKey === API_KEY) {
        next(); // Se a chave de API estiver correta, continue para a próxima função
    } else {
        res.status(403).json({ message: 'Acesso negado: chave de API inválida.' }); // Acesso negado
    }
};

export default authenticate;


// src
import { getDatabase, ref, set, get } from "firebase/database";

const db = getDatabase();

export async function checkRegisteredApiKeys() {
    const apiKeysRef = ref(db, "apiKeys/");
    const snapshot = await get(apiKeysRef);
    if (snapshot.exists()) {
        return Object.keys(snapshot.val()).map(key => snapshot.val()[key].key);
    } else {
        console.log("No data available");
        return [];
    }
}

export async function registerApiKey(apiKey) {
    const apiKeyRef = ref(db, "apiKeys/" + apiKey);
    await set(apiKeyRef, { key: apiKey });
    console.log("Chave de API registrada com sucesso!");
}

export function isValidApiKey(key) {
    const apiKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return apiKeyPattern.test(key);
}
