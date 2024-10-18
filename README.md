# Sistema de Autenticação com Chave de API 🔑

Este projeto é um sistema que permite o login usando uma chave de API única para acessar funcionalidades exclusivas. Ele é ideal para testar a autenticação em um ambiente simulado.

## Tabela de Conteúdos 📑
- [Sobre](#sobre)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Instalação](#instalacao)
- [Uso](#uso)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Contribuição](#contribuicao)
- [Licença](#licenca)

## Sobre ℹ️
Este sistema oferece uma interface para que os usuários façam login usando uma chave de API específica. O acesso às funcionalidades é controlado por essa chave, permitindo uma experiência personalizada.

## Tecnologias Utilizadas 💻
- **Node.js**: Ambiente de execução JavaScript no lado do servidor.
- **Express**: Framework para construir aplicações web em Node.js.
- **WebSocket**: Protocolo para comunicação em tempo real entre cliente e servidor.
- **dotenv**: Carrega variáveis de ambiente a partir de um arquivo `.env`.
- **cors**: Middleware para habilitar CORS (Cross-Origin Resource Sharing).
- **Svelte**: Framework de desenvolvimento de interfaces que permite criar aplicações reativas.
- **Tailwind CSS**: Framework CSS para criar interfaces responsivas e personalizáveis.
- **Vite**: Ferramenta de construção que permite um desenvolvimento rápido e otimizado.
- **Firebase**: Plataforma de desenvolvimento que fornece serviços como autenticação e banco de dados em tempo real.
- **Font Awesome**: Biblioteca de ícones vetoriais e fontes para uso em projetos web.

## Instalação 🔧
Para instalar e executar este projeto, siga as instruções abaixo:

1. Clone este repositório para sua máquina local:
>git clone https://github.com/seu_usuario/seu_repositorio.git


2. Navegue até o diretório do projeto:
>cd seu_repositorio

3. Instale as dependências:
>npm install

4. Crie um arquivo .env na raiz do projeto e adicione as seguintes variáveis de ambiente:
BLIP_IDENTIFIER=asktothevesselofexistence1  
BLIP_API_KEY=b0d6972e-f3cf-4e0e-a9af-5403be4328c9 //Utilize uma sua se preferir ou pode registrar
BLIP_WS_ENDPOINT=ws://rafael-correia-y0tjz.ws.msging.net

## Uso 🚀
Servidor Backend
1. Para iniciar o servidor backend, execute:
node server.js

2. O servidor estará rodando na porta 3000.

## Ambiente de Desenvolvimento
1. Para iniciar o ambiente de desenvolvimento com Vite, execute:
npm run dev

1. O ambiente de desenvolvimento estará disponível na porta especificada pelo Vite (geralmente 5000). Acesse o localhost:5000 e suas rotas para verificar localhost:5000/login.

## Estrutura do Projeto 📂

C:\Users\API-routes-blip\
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

