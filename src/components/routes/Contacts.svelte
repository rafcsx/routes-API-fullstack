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
            console.log('API Key:', apiKey);

            const response = await fetch(`http://localhost:3000/api/contacts`, {
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

    onMount(() => {
        if (!apiKey) {
            navigate('/login');
        } else {
            fetchContacts();
        }
    });
</script>

<div class="container">
    <h1 class="title">Lista de Contatos</h1>
    {#if errorMessage}
        <p class="error">{errorMessage}</p>
    {/if}
    {#if contacts.length === 0}
        <p>Nenhum contato encontrado.</p>
    {:else}
        <ul class="contact-list">
            {#each currentContacts() as contact}
                <li>
                    <button 
                        on:click={() => goToConversation(contact.id)} 
                        type="button" 
                        class="contact-button"
                    >
                        <i class="fas fa-user"></i> {contact.name}
                    </button>
                </li>
            {/each}
        </ul>

        <div class="pagination">
            {#each Array(Math.ceil(totalContacts / contactsPerPage)) as _, index}
                <button 
                    on:click={() => changePage(index + 1)} 
                    disabled={currentPage === index + 1}
                    class="page-button {currentPage === index + 1 ? 'disabled' : ''}"
                >
                    {index + 1}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .container {
        max-width: 600px;
        margin: 50px auto;
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        text-align: center;
    }

    .title {
        font-size: 2rem;
        margin-bottom: 20px;
        color: #333;
    }

    .error {
        color: red;
    }

    .contact-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .contact-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
        margin: 5px 0;
        background-color: #f0f0f0;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .contact-button:hover {
        background-color: #e0e0e0;
    }

    .pagination {
        margin-top: 20px;
    }

    .page-button {
        padding: 5px 10px;
        margin: 0 2px;
        cursor: pointer;
        border: none;
        border-radius: 5px;
        background-color: #007bff;
        color: white;
    }

    .page-button.disabled {
        background-color: #cccccc;
        cursor: not-allowed;
    }
</style>
