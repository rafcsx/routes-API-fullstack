<script lang="ts">
    import { onMount } from "svelte";
    import { navigate } from "svelte-routing";
    import { initializeApp } from "firebase/app";
    import { getDatabase, ref, set, get, child } from "firebase/database";

    //firebaseConfig para testes
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

    let apiKey: string = "";
    let errorMessage: string = "";
    let registeredApiKeys: string[] = [];
    let newApiKey: string = "";
    onMount(() => {
        checkRegisteredApiKeys();
    });

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

    function authenticate() {
        if (registeredApiKeys.includes(apiKey)) {
            localStorage.setItem("apiKey", apiKey);
            navigate("/");
        } else {
            errorMessage = "Chave de API inválida. Tente novamente.";
        }
    }

    function handleSubmit(event: Event) {
        event.preventDefault();
        authenticate();
    }

    function handleRegister(event: Event) {
        event.preventDefault();
        if (isValidApiKey(newApiKey)) {
            // Verifique se a chave já está registrada
            if (registeredApiKeys.includes(newApiKey)) {
                alert("Essa chave de API já está registrada.");
                return;
            }

            const apiKeyRef = ref(db, "apiKeys/" + newApiKey);
            set(apiKeyRef, {
                key: newApiKey,
            })
                .then(() => {
                    alert("Chave de API registrada com sucesso!");
                    newApiKey = ""; // Limpa o campo após o registro
                    checkRegisteredApiKeys(); // Atualiza a lista de chaves registradas
                })
                .catch((error) => {
                    console.error("Erro ao registrar chave de API:", error);
                    alert("Erro ao registrar chave de API. Tente novamente.");
                });
        } else {
            alert(
                "Chave de API inválida. O formato deve ser: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
            );
        }
    }

    function isValidApiKey(key: string) {
        const apiKeyPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return apiKeyPattern.test(key);
    }
</script>

<div
    class="flex flex-col items-center justify-center min-h-screen text-gray-100"
>
    <div class="max-w-md w-full p-8 bg-gray-800 bordered text-center pixelated">
        <h2 class="text-2xl mb-4 text-pixelated">Login</h2>
        {#if errorMessage}
            <p class="text-red-400">{errorMessage}</p>
        {/if}
        <form on:submit={handleSubmit}>
            <input
                type="text"
                placeholder="Insira sua chave de API"
                bind:value={apiKey}
                required
                class="w-full p-2 mb-4 border-2 border-gray-600 bg-gray-700 text-gray-100 pixelated"
            />
            <button
                type="submit"
                class="w-full py-2 bg-gray-700 text-gray-100 hover:bg-gray-600 pixelated"
            >
                Entrar
            </button>
        </form>
    </div>

    <!-- Painel de Registro da Chave API -->
    <div
        class="max-w-md w-full p-8 bg-gray-800 bordered text-center pixelated mt-6"
    >
        <h2 class="text-2xl mb-4 text-pixelated">Registrar Chave de API</h2>
        <form on:submit={handleRegister}>
            <input
                type="text"
                placeholder="Insira a nova chave de API"
                bind:value={newApiKey}
                required
                class="w-full p-2 mb-4 border-2 border-gray-600 bg-gray-700 text-gray-100 pixelated"
            />
            <button
                type="submit"
                class="w-full py-2 bg-gray-700 text-gray-100 hover:bg-gray-600 pixelated"
            >
                Registrar
            </button>
        </form>
    </div>

    <!-- Painéis de informações -->
    <div class="mt-6 flex flex-col items-center w-full px-4">
        <div
            class="panel bordered p-4 w-full max-w-md mb-4 text-center pixelated"
        >
            <h3 class="text-lg mb-2 text-pixelated">
                <i class="fas fa-info-circle"></i> Sobre o Sistema
            </h3>
            <p>
                O sistema valida uma chave de API e carrega um banco de dados de
                mensagens, simulando endpoints para tratativa com logs,
                mensagens recebidas e enviadas.
            </p>
        </div>
        <div
            class="panel bordered p-4 w-full max-w-md mb-4 text-center pixelated"
        >
            <h3 class="text-lg mb-2 text-pixelated">
                <i class="fas fa-question-circle"></i> Ajuda
            </h3>
            <p>
                Para registrar uma nova chave de API, siga as instruções do
                sistema. Após registrar, você poderá validar suas mensagens.
            </p>
            <p class="text-yellow-400 mt-2">
                <strong>Observação:</strong> Você pode registrar uma chave falsa, só precisa ser o mesmo formato.
            </p>
        </div>
        <div
            class="panel bordered p-4 w-full max-w-md mb-4 text-center pixelated"
        >
            <h3 class="text-lg mb-2 text-pixelated">
                <i class="fas fa-server"></i> Servidor Simulado
            </h3>
            <p>
                Inicie o servidor com o comando <code>npm run dev</code> para o
                front e <code>node server.js</code> para o backend.
            </p>
            <p><strong>Instruções de instalação:</strong></p>
            <ol class="list-decimal pl-6">
                <li>Clone o repositório.</li>
                <li>Instale as dependências com <code>npm install</code>.</li>
                <li>
                    Inicie o servidor com <code>node server.js</code> para o backend.
                </li>
                <li>
                    Execute <code>npm run dev</code> para rodar a aplicação no frontend.
                </li>
                <li>Após registrar sua chave de API, você poderá testá-la.</li>
            </ol>
        </div>
    </div>
</div>

<!-- Adicione o link para o Tailwind CSS no seu HTML -->
<link
    href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
    rel="stylesheet"
/>
<link
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
    rel="stylesheet"
/>

<style>
    @import url("https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;700&display=swap");

    :global(body) {
        font-family: "Source Code Pro", monospace;
        background-color: #1a1a1a;
        background-image: url("https://www.transparenttextures.com/patterns/cubes.png");
        color: #ccc;
        margin: 0;
        padding: 0;
    }

    .pixelated {
        image-rendering: pixelated;
    }

    .text-pixelated {
        font-family: "Source Code Pro", monospace;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    .bordered {
        border: 2px solid #555;
        border-radius: 0;
    }

    .panel {
        background-color: #2a2a2a;
        border-radius: 8px;
        transition:
            transform 0.3s,
            box-shadow 0.3s;
    }

    .panel:hover {
        transform: translateY(-5px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }

    input:focus,
    button:focus {
        outline: none;
        box-shadow: none;
    }

    input {
        transition:
            border-color 0.3s,
            box-shadow 0.3s;
    }

    input:hover,
    input:focus {
        border-color: #ccc;
    }
</style>
