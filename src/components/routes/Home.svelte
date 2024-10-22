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

    async function fetchContacts() {
        try {
            console.log('Fetching contacts...');
            const response = await fetch('http://localhost:3000/api/contacts', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    errorMessage = 'Unauthorized access. Please log in again.';
                } else if (response.status === 404) {
                    errorMessage = 'Contacts not found.';
                } else {
                    errorMessage = 'Error fetching contacts. Please try again later.';
                }
                throw new Error('Failed to fetch contacts');
            }

            const data = await response.json();
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

    function goToConversation(contactId: string) {
        navigate(`/contato/${contactId}`);
    }

    function currentContacts(): Contact[] {
        const startIndex: number = (currentPage - 1) * contactsPerPage;
        return contacts.slice(startIndex, startIndex + contactsPerPage);
    }

    function changePage(page: number) {
        currentPage = page;
    }

    onMount(() => {
        if (!apiKey) {
            navigate('/login');
        } else {
            fetchContacts();
        }
    });
</script>

<div class="max-w-md mx-auto my-12 p-8 bg-white rounded-lg shadow-lg text-center">
    <h1 class="text-4xl mb-6 font-semibold text-gray-800">Lista de Contatos</h1>
    
    {#if errorMessage}
        <p class="text-red-500 mb-4">{errorMessage}</p>
    {/if}
    
    {#if contacts.length === 0}
        <p class="text-gray-500">Nenhum contato encontrado.</p>
    {:else}
        <ul class="list-none p-0 m-0 space-y-2">
            {#each currentContacts() as contact}
                <li>
                    <button 
                        on:click={() => goToConversation(contact.id)} 
                        type="button" 
                        class="flex items-center justify-start w-full py-3 px-4 bg-gray-100 rounded-lg transition duration-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <i class="fas fa-user-circle text-xl mr-3"></i>
                        <span class="text-left">{contact.name}</span>
                    </button>
                </li>
            {/each}
        </ul>

        <div class="mt-4 flex justify-center space-x-2">
            {#each Array(Math.ceil(totalContacts / contactsPerPage)) as _, index}
                <button 
                    on:click={() => changePage(index + 1)} 
                    disabled={currentPage === index + 1}
                    class="px-4 py-2 rounded-lg bg-blue-500 text-white transition duration-300 disabled:bg-gray-300 hover:bg-blue-600"
                >
                    {index + 1}
                </button>
            {/each}
        </div>
    {/if}
</div>
