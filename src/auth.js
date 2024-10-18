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
