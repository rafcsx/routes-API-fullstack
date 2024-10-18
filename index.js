import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import WebSocket from 'ws';
import url from 'url';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware para permitir CORS
app.use(cors({
    origin: 'http://localhost:5000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para permitir o preflight
app.options('*', cors({
    origin: 'http://localhost:5000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Log para verificar as variáveis de ambiente
const IDENTIFIER = process.env.BLIP_IDENTIFIER; 
const ACCESS_KEY = process.env.BLIP_API_KEY; 
const WS_ENDPOINT = process.env.BLIP_WS_ENDPOINT; 

// Verifica se as variáveis de ambiente estão definidas
if (!IDENTIFIER || !ACCESS_KEY || !WS_ENDPOINT) {
    console.error('Erro: BLIP_IDENTIFIER, BLIP_API_KEY e/ou BLIP_WS_ENDPOINT não estão definidos no .env');
    process.exit(1);
}

// Valida a URL do WebSocket
try {
    new url.URL(WS_ENDPOINT);
} catch (e) {
    console.error('Erro: URL inválida para BLIP_WS_ENDPOINT:', WS_ENDPOINT);
    process.exit(1);
}

// Log das credenciais
console.log(`Identifier: ${IDENTIFIER}, Access Key: ${ACCESS_KEY}`);

// Conexão WebSocket com o servidor do BLiP
const ws = new WebSocket(WS_ENDPOINT, ['my-protocol']); // Substitua 'my-protocol' pelo subprotocolo correto

ws.on('open', () => {
    console.log('Conectado ao servidor');

    const msg = {
        "id": "unique-message-id",
        "to": "postmaster@msging.net",
        "type": "text/plain",
        "content": "Hello, BLiP!"
    };

    ws.send(JSON.stringify(msg));
});

ws.on('message', (data) => {
    console.log('Recebido:', data);
});

ws.on('error', (error) => {
    console.error('Erro na conexão:', error);
});

ws.on('close', () => {
    console.log('Conexão fechada');
});

// Inicie o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// Log das variáveis de ambiente para depuração
console.log('Variáveis de ambiente:', process.env);
