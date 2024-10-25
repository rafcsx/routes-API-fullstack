<script lang="ts">
    import { onMount } from "svelte";
    import { navigate } from "svelte-routing";
    import { initializeApp } from "firebase/app";
    import { getDatabase, ref, set, get } from "firebase/database";

    // Configuração do Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyA7bdsMRoNvLc1fGk84tjjCzy8jQgT2VLc",
        authDomain: "svelte-blip-chatbo.firebaseapp.com",
        databaseURL: "https://svelte-blip-chatbo-default-rtdb.firebaseio.com",
        projectId: "svelte-blip-chatbo",
        storageBucket: "svelte-blip-chatbo.appspot.com",
        messagingSenderId: "494627128433",
        appId: "1:494627128433:web:99099a19db8eee632687d0",
    };

   
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    // Variáveis de estado
    let apiKey: string = "";
    let errorMessage: string = "";
    let registeredApiKeys: string[] = [];
    let newApiKey: string = "";

    // Monta o componente e verifica chaves registradas
    onMount(() => {
        checkRegisteredApiKeys();
    });

    // Verifica chaves de API registradas no Firebase
    function checkRegisteredApiKeys() {
        const apiKeysRef = ref(db, "apiKeys/");
        get(apiKeysRef)
            .then((snapshot) => {
                if (snapshot.exists()) {
                    registeredApiKeys = Object.keys(snapshot.val()).map(
                        (key) => snapshot.val()[key].key,
                    );
                } else {
                    console.log("No data available");
                }
            })
            .catch((error) => {
                console.error("Erro ao buscar chaves de API:", error);
            });
    }

    // Autentica o usuário com a chave de API
    function authenticate() {
        if (registeredApiKeys.includes(apiKey)) {
            localStorage.setItem("apiKey", apiKey);
            navigate("/");
        } else {
            errorMessage = "Chave de API inválida. Tente novamente.";
        }
    }

    // Manipula o envio do formulário de login
    function handleSubmit(event: Event) {
        event.preventDefault();
        authenticate();
    }

    // Manipula o envio do formulário de registro
    function handleRegister(event: Event) {
        event.preventDefault();
        if (isValidApiKey(newApiKey)) {
            if (registeredApiKeys.includes(newApiKey)) {
                alert("Essa chave de API já está registrada.");
                return;
            }

            registerApiKey(newApiKey);
        } else {
            alert("Chave de API inválida. O formato deve ser: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX");
        }
    }

    // Registra a nova chave de API no Firebase
    function registerApiKey(apiKey: string) {
        const apiKeyRef = ref(db, "apiKeys/" + apiKey);
        set(apiKeyRef, { key: apiKey })
            .then(() => {
                alert("Chave de API registrada com sucesso!");
                newApiKey = ""; // Limpa o campo após o registro
                checkRegisteredApiKeys(); // Atualiza a lista de chaves registradas
            })
            .catch((error) => {
                console.error("Erro ao registrar chave de API:", error);
                alert("Erro ao registrar chave de API. Tente novamente.");
            });
    }

    // Valida o formato da chave de API
    function isValidApiKey(key: string): boolean {
        const apiKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return apiKeyPattern.test(key);
    }
</script>

<div class="flex flex-col items-center justify-center min-h-screen text-gray-100">
    <div class="max-w-md w-full p-8 bg-gray-800 border-2 border-gray-600 rounded-lg text-center">
        <h2 class="text-2xl mb-4">
            <i class="fas fa-lock mr-2"></i>Login
        </h2>
        {#if errorMessage}
            <p class="text-red-400">{errorMessage}</p>
        {/if}
        <form on:submit={handleSubmit}>
            <input
                type="text"
                placeholder="Insira sua chave de API"
                bind:value={apiKey}
                required
                class="w-full p-2 mb-4 border-2 border-gray-600 bg-gray-700 text-gray-100"
            />
            <button
                type="submit"
                class="w-full py-2 bg-gray-700 text-gray-100 hover:bg-gray-600"
            >
                <i class="fas fa-sign-in-alt mr-2"></i>Entrar
            </button>
        </form>
    </div>

    <!-- Painel de Registro da Chave API -->
    <div class="max-w-md w-full p-8 bg-gray-800 border-2 border-gray-600 rounded-lg text-center mt-6">
        <h2 class="text-2xl mb-4">
            <i class="fas fa-pencil-alt mr-2"></i>Registrar Chave de API
        </h2>
        <form on:submit={handleRegister}>
            <input
                type="text"
                placeholder="Insira a nova chave de API"
                bind:value={newApiKey}
                required
                class="w-full p-2 mb-4 border-2 border-gray-600 bg-gray-700 text-gray-100"
            />
            <button
                type="submit"
                class="w-full py-2 bg-gray-700 text-gray-100 hover:bg-gray-600"
            >
                <i class="fas fa-plus-circle mr-2"></i>Registrar
            </button>
        </form>
    </div>

    <!-- Painéis de informações -->
    <div class="mt-6 flex flex-col items-center w-full px-4">
        <div class="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 w-full max-w-md mb-4 text-center">
            <h3 class="text-lg mb-2">
                <i class="fas fa-info-circle mr-2"></i>Sobre o Sistema
            </h3>
            <p>
                O sistema valida uma chave de API e carrega um banco de dados de mensagens, simulando endpoints para tratativa com logs, mensagens recebidas e enviadas.
            </p>
        </div>
        <div class="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 w-full max-w-md mb-4 text-center">
            <h3 class="text-lg mb-2">
                <i class="fas fa-question-circle mr-2"></i>Ajuda
            </h3>
            <p>
                Para registrar uma nova chave de API, siga as instruções do sistema. Após registrar, você poderá validar suas mensagens.
            </p>
            <p class="text-yellow-400 mt-2">
                <strong>Observação:</strong> Você pode registrar uma chave falsa, só precisa ser o mesmo formato.
            </p>
        </div>
        <div class="bg-gray-800 border-2 border-gray-600 rounded-lg p-4 w-full max-w-md mb-4 text-center">
            <h3 class="text-lg mb-2">
                <i class="fas fa-server mr-2"></i>Servidor Simulado
            </h3>
            <p>
                Inicie o servidor com o comando <code>npm run dev</code> para o front e <code>node server.js</code> para o backend.
            </p>
            <p><strong>Instruções de instalação:</strong></p>
            <ol class="list-decimal pl-6">
                <li>Clone o repositório.</li>
                <li>Instale as dependências com <code>npm install</code>.</li>
                <li>Inicie o servidor com <code>node server.js</code> para o backend.</li>
                <li>Execute <code>npm run dev</code> para rodar a aplicação no frontend.</li>
                <li>Após registrar sua chave de API, você poderá testá-la.</li>
            </ol>
        </div>
    </div>
</div>

<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" rel="stylesheet" />

<style>
    @import url("https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;700&display=swap");

    :global(body) {
        font-family: "Source Code Pro", monospace;
        background-color: #1a1a1a;
        background-image: url("https://www.transparenttextures.com/patterns/cubes.png");
        color: #ccc;
        margin: 0;
    }
</style>