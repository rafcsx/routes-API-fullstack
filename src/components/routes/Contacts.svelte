<script lang="ts">
    import { onMount } from 'svelte';
    import { navigate } from 'svelte-routing';

    interface Contact {
        id: string;
        name: string;
    }

    let contacts: Contact[] = [];
    let currentPage: number = 1;
    const contactsPerPage: number = 10;
    let totalContacts: number = 0;
    const apiKey: string | null = localStorage.getItem('apiKey');

    let errorMessage: string = '';

    // Funções
    async function fetchContacts() {
        try {
            console.log('Fetching contacts...');
            console.log('API Key:', apiKey);

            const response = await fetch(`http://localhost:3000/api/contacts`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                handleFetchError(response);
                throw new Error('Failed to fetch contacts');
            }

            const data = await response.json();
            console.log('Fetched data:', data);
            contacts = data.contacts || [];
            totalContacts = contacts.length;

        } catch (error) {
            console.error('Error:', error);
            errorMessage = 'Erro ao buscar contatos. Redirecionando para login...';
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        }
    }

    function handleFetchError(response: Response) {
        if (response.status === 401) {
            errorMessage = 'Unauthorized access. Please log in again.';
        } else if (response.status === 404) {
            errorMessage = 'Contacts not found.';
        } else {
            errorMessage = 'Error fetching contacts. Please try again later.';
        }
    }

    function goToConversation(contactId: string) {
        console.log('Navigating to conversation with contact ID:', contactId);
        navigate(`/contato/${contactId}`);
    }

    function currentContacts(): Contact[] {
        const startIndex: number = (currentPage - 1) * contactsPerPage;
        const current = contacts.slice(startIndex, startIndex + contactsPerPage);
        console.log('Current contacts:', current);
        return current;
    }

    function changePage(page: number) {
        currentPage = page;
    }

    // Lifecycle
    onMount(() => {
        if (!apiKey) {
            navigate('/login');
        } else {
            fetchContacts();
        }
    });
</script>

<div class="max-w-lg mx-auto my-12 p-6 bg-white rounded-lg shadow-lg text-center">
    <h1 class="text-2xl font-semibold mb-4">Lista de Contatos</h1>
    {#if errorMessage}
        <p class="text-red-500">{errorMessage}</p>
    {/if}
    {#if contacts.length === 0}
        <p>Nenhum contato encontrado.</p>
    {:else}
        <ul class="list-none p-0 m-0">
            {#each currentContacts() as contact}
                <li>
                    <button 
                        on:click={() => goToConversation(contact.id)} 
                        type="button" 
                        class="flex items-center justify-center px-4 py-2 my-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors duration-300"
                    >
                        <i class="fas fa-user"></i> {contact.name}
                    </button>
                </li>
            {/each}
        </ul>

        <div class="mt-4">
            {#each Array(Math.ceil(totalContacts / contactsPerPage)) as _, index}
                <button 
                    on:click={() => changePage(index + 1)} 
                    disabled={currentPage === index + 1}
                    class="px-2 py-1 mx-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 transition-colors duration-300"
                >
                    {index + 1}
                </button>
            {/each}
        </div>
    {/if}
</div>
