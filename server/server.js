// Servidor Simulado; Execute node server.js, npm run dev para rodar a aplicação. 
// Insira a ID de acesso na tela de login no localhost: [b0d6972e-f3cf-4e0e-a9af-5403be4328c9].

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: 'http://localhost:5000' }));
app.use(bodyParser.json());

// Rota de teste
app.get('/', (req, res) => {
    res.send('API está funcionando!');
});

// Dados de exemplo
let contacts = [
    { id: 1, name: 'João Silva' },
    { id: 2, name: 'Maria Oliveira' },
    { id: 3, name: 'Pedro Santos' },
    { id: 4, name: 'Lucas Almeida' },
    { id: 5, name: 'Ana Costa' },
    { id: 6, name: 'Roberta Lima' },
    { id: 7, name: 'Felipe Moura' },
    { id: 8, name: 'Carla Souza' },
    { id: 9, name: 'Ricardo Ferreira' },
    { id: 10, name: 'Tatiane Ribeiro' },
];

// Logs de chat fictícios
let chatLogs = Array.from({ length: contacts.length }, (_, index) => ({
    contactId: contacts[index].id,
    logs: [],
}));

// Gerar logs fictícios
function generateFakeChatLogs() {
    const fakeMessages = [
        { from: 'João Silva', text: 'Oi, tudo bem?' },
        { from: 'Maria Oliveira', text: 'Olá! Como você está?' },
        { from: 'Pedro Santos', text: 'Oi, estou por aqui!' },
        { from: 'Lucas Almeida', text: 'Estou com dúvida sobre o projeto.' },
        { from: 'Ana Costa', text: 'Você pode me ajudar com a instalação?' },
        { from: 'Roberta Lima', text: 'Qual é a melhor prática para isso?' },
        { from: 'Felipe Moura', text: 'Estou enfrentando problemas com o código.' },
        { from: 'Carla Souza', text: 'Alguma dica para otimizar o desempenho?' },
        { from: 'Ricardo Ferreira', text: 'Como posso resolver esse bug?' },
        { from: 'Tatiane Ribeiro', text: 'Tem como fazer isso de outra forma?' },
    ];

    contacts.forEach(contact => {
        for (let i = 0; i < 5; i++) {
            const randomMessage = fakeMessages[Math.floor(Math.random() * fakeMessages.length)];
            const timestamp = new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(); // Gera um timestamp aleatório
            chatLogs.find(log => log.contactId === contact.id).logs.push({
                id: i + 1,
                from: randomMessage.from,
                content: randomMessage.text,
                timestamp,
            });
        }
    });
}

// Endpoint para obter contatos
app.get('/api/contacts', (req, res) => {
    res.json({ contacts });
});

// Endpoint para obter logs de chat
app.get('/api/chat-logs', (req, res) => {
    res.json(chatLogs);
});

// Adicionar um novo contato
app.post('/api/contacts', (req, res) => {
    const newContact = req.body;
    newContact.id = contacts.length + 1; // Gerar um ID único
    contacts.push(newContact);
    // Adiciona logs fictícios para o novo contato
    chatLogs.push({ contactId: newContact.id, logs: [] });
    res.status(201).json(newContact);
});

// Atualizar um contato existente
app.put('/api/contacts/:id', (req, res) => {
    const contactId = parseInt(req.params.id);
    const index = contacts.findIndex(c => c.id === contactId);

    if (index === -1) {
        return res.status(404).send('Contato não encontrado');
    }

    contacts[index] = { id: contactId, ...req.body };
    res.json(contacts[index]);
});

// Deletar um contato
app.delete('/api/contacts/:id', (req, res) => {
    const contactId = parseInt(req.params.id);
    contacts = contacts.filter(c => c.id !== contactId);
    chatLogs = chatLogs.filter(log => log.contactId !== contactId); // Remove os logs associados
    res.status(204).send(); // Sem conteúdo
});

// Endpoint do webhook
app.post('/api/webhook', (req, res) => {
    const data = req.body; // Captura os dados enviados pelo webhook

    // Processa os dados conforme necessário
    console.log('Dados recebidos do webhook:', data);
    
    // Suponha que os dados tenham uma estrutura como { name: 'Novo Contato' }
    const newContact = {
        id: contacts.length + 1, // Gerar um ID único
        name: data.name || 'Contato sem nome', // Se não houver nome, um padrão
    };
    contacts.push(newContact);
    
    // Adiciona logs fictícios para o novo contato
    chatLogs.push({ contactId: newContact.id, logs: [] });
    
    res.status(201).json(newContact); // Retorna o contato adicionado
});

// Inicializando o servidor
generateFakeChatLogs(); // Gera logs fictícios ao iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
