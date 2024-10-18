<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>README - Sistema de Autenticação com Chave de API</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
        }
        h1, h2, h3 {
            color: #333;
        }
        ul {
            list-style-type: none;
            padding: 0;
        }
        ul li {
            margin: 5px 0;
        }
        code {
            background: #eee;
            padding: 2px 4px;
            border-radius: 4px;
        }
        pre {
            background: #333;
            color: #fff;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
        .icon {
            margin-right: 5px;
        }
    </style>
</head>
<body>
    <h1>Sistema de Autenticação com Chave de API 🔑</h1>
    <p>Este projeto é um sistema que permite o login usando uma chave de API única para acessar funcionalidades exclusivas. Ele é ideal para testar a autenticação em um ambiente simulado.</p>

    <h2>Tabela de Conteúdos 📑</h2>
    <ul>
        <li><a href="#sobre">Sobre</a></li>
        <li><a href="#tecnologias-utilizadas">Tecnologias Utilizadas</a></li>
        <li><a href="#instalacao">Instalação</a></li>
        <li><a href="#uso">Uso</a></li>
        <li><a href="#estrutura-do-projeto">Estrutura do Projeto</a></li>
        <li><a href="#documentacao">Documentação</a></li>
        <li><a href="#contribuicao">Contribuição</a></li>
        <li><a href="#licenca">Licença</a></li>
    </ul>

    <h2 id="sobre">Sobre ℹ️</h2>
    <p>Este sistema oferece uma interface para que os usuários façam login usando uma chave de API específica. O acesso às funcionalidades é controlado por essa chave, permitindo uma experiência personalizada.</p>

    <h2 id="tecnologias-utilizadas">Tecnologias Utilizadas 💻</h2>
    <ul>
        <li><strong>Node.js</strong>: Ambiente de execução JavaScript no lado do servidor.</li>
        <li><strong>Express</strong>: Framework para construir aplicações web em Node.js.</li>
        <li><strong>WebSocket</strong>: Protocolo para comunicação em tempo real entre cliente e servidor.</li>
        <li><strong>dotenv</strong>: Carrega variáveis de ambiente a partir de um arquivo .env.</li>
        <li><strong>cors</strong>: Middleware para habilitar CORS (Cross-Origin Resource Sharing).</li>
        <li><strong>Svelte</strong>: Framework de desenvolvimento de interfaces que permite criar aplicações reativas.</li>
        <li><strong>Tailwind CSS</strong>: Framework CSS para criar interfaces responsivas e personalizáveis.</li>
        <li><strong>Vite</strong>: Ferramenta de construção que permite um desenvolvimento rápido e otimizado.</li>
        <li><strong>Firebase</strong>: Plataforma de desenvolvimento que fornece serviços como autenticação e banco de dados em tempo real.</li>
        <li><strong>Font Awesome</strong>: Biblioteca de ícones vetoriais e fontes para uso em projetos web.</li>
    </ul>

    <h2 id="instalacao">Instalação 🔧</h2>
    <p>Para instalar e executar este projeto, siga as instruções abaixo:</p>
    <ol>
        <li>Clone este repositório para sua máquina local:
            <pre><code>git clone https://github.com/seu_usuario/seu_repositorio.git</code></pre>
        </li>
        <li>Navegue até o diretório do projeto:
            <pre><code>cd seu_repositorio</code></pre>
        </li>
        <li>Instale as dependências:
            <pre><code>npm install</code></pre>
        </li>
        <li>Crie um arquivo <code>.env</code> na raiz do projeto e adicione as seguintes variáveis de ambiente:
            <pre><code>BLIP_IDENTIFIER=asktothevesselofexistence1
BLIP_API_KEY=b0d6972e-f3cf-4e0e-a9af-5403be4328c9
BLIP_WS_ENDPOINT=ws://rafael-correia-y0tjz.ws.msging.net</code></pre>
        </li>
    </ol>

    <h2 id="uso">Uso 🚀</h2>
    <h3>Servidor Backend</h3>
    <ol>
        <li>Para iniciar o servidor backend, execute:
            <pre><code>node server.js</code></pre>
        </li>
        <li>O servidor estará rodando na porta 3000.</li>
    </ol>

    <h3>Ambiente de Desenvolvimento</h3>
    <ol>
        <li>Para iniciar o ambiente de desenvolvimento com Vite, execute:
            <pre><code>npm run dev</code></pre>
        </li>
        <li>O ambiente de desenvolvimento estará disponível na porta especificada pelo Vite (geralmente 3000 ou 5000).</li>
    </ol>

    <h2 id="estrutura-do-projeto">Estrutura do Projeto 📂</h2>
    <pre><code>C:\Users\wizd_\API-routes-blip\
│
├── .netlify\
│   └── functions\
│       └── myFunction.js
├── node_modules\
├── public\
│   ├── build\
│   ├── favicon.png
│   ├── global.css
│   └── index.html
├── scripts\
├── src\
│   ├── components\
│   ├── App.svelte
│   ├── auth.js
│   ├── firebase.js
│   ├── global.css
│   ├── main.js
│   └── setupProxy.js
├── .env
├── .gitignore
├── index.js
├── netlify.toml
├── package-lock.json
├── package.json
├── README.md
├── rollup.config.js
├── server.js
├── tailwind.config.js
├── tsconfig.json
├── vite.config.js
└── yarn.lock
</code></pre>
    <h2 id="contribuicao">Contribuição 🤝</h2>
    <p>Contribuições são bem-vindas! Se você tem alguma ideia ou encontrou um bug, por favor, abra uma issue ou envie um pull request.</p>
</body>
</html>
