<script>
    import { onMount } from 'svelte';
    import { navigate, useParams } from 'svelte-routing';

    // Variáveis reativas
    let messages = [];    
    let contactId = '';     
    let errorMessage = '';  

    const apiKey = localStorage.getItem('apiKey'); 
    const { id } = useParams(); 

    // Função para buscar mensagens do contato
    async function fetchMessages() {
        try {
            const response = await fetch(`http://localhost:3000/api/messages/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            // Verifica se a resposta é bem-sucedida
            if (!response.ok) {
                throw new Error('Erro ao buscar mensagens');
            }

            // Processa os dados recebidos
            const data = await response.json();
            messages = data.messages || [];
        } catch (error) {
            console.error('Error:', error);
            errorMessage = 'Erro ao carregar mensagens. Redirecionando para a lista de contatos...'; 
            setTimeout(() => {
                navigate('/'); // Redireciona para a lista de contatos
            }, 3000);
        }
    }

    // Monta o componente
    onMount(() => {
        if (!apiKey) {
            navigate('/login'); // Redireciona para a página de login se a chave da API não estiver disponível
        } else {
            contactId = id; // Define o ID do contato
            fetchMessages(); // Chama a função para buscar mensagens
        }
    });
</script>

<div class="conversation-container">
    <h1>Conversa com {contactId}</h1>
    {#if errorMessage}
        <p class="error">{errorMessage}</p>
    {/if}
    <ul>
        {#each messages as message}
            <li>{message.content}</li> 
        {/each}
    </ul>
</div>

<style>
    .conversation-container {
        max-width: 600px;
        margin: 50px auto; 
        padding: 20px; 
        background: white; 
        border-radius: 8px; 
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); 
        text-align: left; 
    }

    .error {
        color: red; 
    }
</style>
