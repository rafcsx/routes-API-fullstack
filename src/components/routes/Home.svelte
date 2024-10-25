<script lang="ts">
    import { onMount } from 'svelte';
    import { navigate } from 'svelte-routing';

    let isAuthenticated = false;
    let apiKey: string | null = null; // Defina o tipo da apiKey como string ou null

    onMount(() => {
        apiKey = localStorage.getItem('apiKey'); // Recupera a chave da API
        isAuthenticated = !!apiKey; // Verifica se o usuário está autenticado

        if (!isAuthenticated) {
            // navigate('/login'); // Descomente se você deseja redirecionar para login
        }
    });
</script>

<div class="container mx-auto p-4">
    {#if isAuthenticated}
        <h1 class="text-3xl font-bold">Bem-vindo à Página Inicial</h1>
        <p>Aqui estão as informações da API que você pode acessar.</p>

        <div class="bg-gray-100 border border-gray-300 rounded p-4 mt-4">
            <h2 class="text-xl font-semibold mb-2">Informações do Projeto</h2>
            <p><strong>Framework Utilizado:</strong> Svelte</p>
            <p><strong>ID da API Atual:</strong> {apiKey}</p>
            <p><strong>Descrição:</strong> Esta aplicação permite que você interaja com a API, visualize contatos e faça login para acessar funcionalidades adicionais.</p>
            <div class="mt-4">
                <a href="/contatos" class="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200 mr-2">Ir para Contatos</a>
            </div>
        </div>
        
    {:else}
        <h1 class="text-3xl font-bold">Acesso Negado</h1>
        <p>Por favor, faça login para acessar esta página.</p>
        <a href="/login" class="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition duration-200">Login</a>
    {/if}
</div>
