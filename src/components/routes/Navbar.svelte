<script lang="ts">
    import { onMount } from 'svelte';
    import { navigate } from 'svelte-routing';

    let isAuthenticated = false;

    onMount(() => {
        const apiKey = localStorage.getItem('apiKey');
        isAuthenticated = !!apiKey;

        // Adiciona um listener para rolagem da página
        window.addEventListener('scroll', handleScroll);
    });

    function handleScroll() {
        const navbar = document.querySelector('.navbar') as HTMLElement;
        if (window.scrollY > 0) {
            navbar.classList.add('bg-gray-900', 'bg-opacity-90');
        } else {
            navbar.classList.remove('bg-gray-900', 'bg-opacity-90');
        }
    }

    function logout() {
        localStorage.removeItem('apiKey');
        isAuthenticated = false;
        navigate('/login');
    }
</script>

<nav class="navbar fixed top-0 left-0 w-full z-50 transition-all duration-300">
    <div class="container mx-auto flex justify-between items-center px-4 py-2">
        <div class="title text-gray-300 text-2xl">API Routes</div>
        <div class="nav-links flex items-center">
            <a href="/" class="nav-link text-white hover:text-gray-300 mr-6 py-2 px-4 transition duration-200">Home</a>
            <a href="/contatos" class="nav-link text-white hover:text-gray-300 mr-6 py-2 px-4 transition duration-200">Contato</a>
            {#if isAuthenticated}
                <button on:click={logout} class="nav-button bg-gray-300 text-gray-900 py-2 px-4 rounded transition duration-200 hover:bg-gray-400">Logout</button>
            {:else}
                <a href="/login" class="nav-link text-white hover:text-gray-300 py-2 px-4 transition duration-200">Login</a>
            {/if}
        </div>
    </div>
</nav>