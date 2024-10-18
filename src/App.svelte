<script>
    import { Router, Route } from 'svelte-routing';
    import Navbar from './components/routes/Navbar.svelte'; 
    import Home from './components/routes/Home.svelte';
    import Login from './components/routes/Login.svelte';
    import ChatComponent from './components/routes/ChatComponent.svelte'; 
    import Contacts from './components/routes/Contacts.svelte'; 

    import { onMount } from 'svelte';

    onMount(() => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/blip-chat-widget';
        script.type = 'text/javascript';
        script.onload = () => {
            const blipChat = new BlipChat()
                .withAppKey(import.meta.env.MYAPP_FIREBASE_API_KEY) // Use a variável de ambiente aqui
                .withButton({ "color": "#0096fa", "icon": "" })
                .withCustomCommonUrl(import.meta.env.MYAPP_FIREBASE_AUTH_DOMAIN) // Outro exemplo
                .build();

            blipChat.on('send', (message) => {
                const payload = {
                    botAccessKey: import.meta.env.MYAPP_FIREBASE_APP_ID, // Use a variável de ambiente aqui
                    message: {
                        content: message.content,
                        type: message.type,
                        from: message.from,
                        to: message.to,
                        timestamp: new Date().toISOString(),
                    },
                };
                sendToWebhook(payload);
            });

            blipChat.on('receive', (message) => {
                const payload = {
                    botAccessKey: import.meta.env.MYAPP_FIREBASE_APP_ID, // Use a variável de ambiente aqui
                    message: {
                        content: message.content,
                        type: message.type,
                        from: message.from,
                        to: message.to,
                        timestamp: new Date().toISOString(),
                    },
                };
                sendToWebhook(payload);
            });
        };
        document.body.appendChild(script);
    });

    async function sendToWebhook(payload) {
        const webhookUrl = import.meta.env.MYAPP_WEBHOOK_URL; // Use a variável de ambiente aqui

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error('Erro ao enviar dados para o webhook:', response.statusText);
            }
        } catch (error) {
            console.error('Erro na requisição ao webhook:', error);
        }
    }
</script>

<Router>
    <Navbar />
    <main>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/contatos" component={Contacts} />
        <Route path="/contato/:id" component={ChatComponent} />
    </main>
</Router>

<style>
    main {
        padding-top: 60px; 
    }
</style>
