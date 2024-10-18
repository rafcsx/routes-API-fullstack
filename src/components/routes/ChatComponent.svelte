<script lang="ts">
    import { onMount } from 'svelte';
    import { initializeApp } from "firebase/app";
    import { getDatabase, ref, set, onValue } from "firebase/database";

    // Configurações do Firebase, chaves de testes e uso livre
    const firebaseConfig = {
        apiKey: "AIzaSyA7bdsMRoNvLc1fGk84tjjCzy8jQgT2VLc",
        authDomain: "svelte-blip-chatbo.firebaseapp.com",
        databaseURL: "https://svelte-blip-chatbo-default-rtdb.firebaseio.com",
        projectId: "svelte-blip-chatbo",
        storageBucket: "svelte-blip-chatbo.appspot.com",
        messagingSenderId: "494627128433",
        appId: "1:494627128433:web:99099a19db8eee632687d0"
    };

    // Inicializa o Firebase
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    let messages = [];
    let newMessage = '';

    // Função para buscar mensagens do Firebase
    function fetchChatLogs() {
        const messagesRef = ref(db, 'messages');
        onValue(messagesRef, (snapshot) => {
            messages = []; // Limpa mensagens antes de popular
            snapshot.forEach((childSnapshot) => {
                const messageData = childSnapshot.val();
                messages.push({
                    content: messageData.content,
                    from: messageData.from,
                    timestamp: messageData.timestamp
                });
            });
            scrollToBottom(); // Rola para a última mensagem quando as mensagens são atualizadas
        });
    }

    // Enviar nova mensagem para o Firebase e Blip
    async function sendMessage() {
        if (newMessage.trim() === '') return;

        const messageData = {
            content: newMessage,
            from: 'Você',
            timestamp: Date.now(),
        };

        try {
            // Envio para o Firebase
            const messageRef = ref(db, 'messages/' + Date.now());
            await set(messageRef, messageData);
            
            // Envio para o Blip
            await fetch('https://withered-grass-6f5a.rafcs-x.workers.dev/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    botAccessKey: 'YXNrdG90aGV2ZXNzZWxvZmV4aXN0ZW5jZTE6ZDQ5MjUzZTUtNmEwOS00ZDRjLTgyZmItMDlkYzAxNjU4YzU0',
                    message: {
                        from: 'Você',
                        to: 'bot',
                        content: {
                            type: 'text',
                            text: newMessage
                        }
                    }
                })
            });

            newMessage = ''; // Limpa o campo de entrada
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }

    // Rola automaticamente para a última mensagem
    onMount(() => {
        fetchChatLogs();
        initBlipChat(); // Inicializa o Blip Chat
    });

    function scrollToBottom() {
        const chatContainer = document.querySelector('.chat-container') as HTMLElement;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function initBlipChat() {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/blip-chat-widget";
        script.onload = () => {
            new BlipChat()
                .withAppKey('YXNrdG90aGV2ZXNzZWxvZmV4aXN0ZW5jZTE6ZDQ5MjUzZTUtNmEwOS00ZDRjLTgyZmItMDlkYzAxNjU4YzU0')
                .withButton({"color":"#00ff00","icon":""}) 
                .withCustomCommonUrl('https://rafael-correia-y0tjz.chat.blip.ai/')
                .withFontColor('#ffffff') 
                .withBackgroundColor('#000000')
                .withHeaderColor('#333333') 
                .withInputBackgroundColor('#222222') 
                .withInputFontColor('#ffffff') 
                .withMessageFromBotBackgroundColor('#444444') 
                .withMessageFromUserBackgroundColor('#555555')
                .build();
        };
        document.head.appendChild(script);
    }
</script>

<div class="chat-container" aria-label="Chat messages">
    <h2>Conversa</h2>
    {#each messages as message}
        <div class={`message ${message.from === 'Você' ? 'user' : 'bot'}`} aria-label={message.from === 'Você' ? 'Mensagem do usuário' : 'Mensagem do bot'}>
            <div class="message-content">
                {message.content}
            </div>
            <div class="timestamp">{new Date(message.timestamp).toLocaleTimeString()}</div>
        </div>
    {/each}
    
    <div class="input-container">
        <input type="text" bind:value={newMessage} placeholder="Digite sua mensagem..." class="input" />
        <button on:click={sendMessage} class="send-button">Enviar</button>
    </div>
</div>

<style>
    .chat-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 1rem;
        max-width: 800px;
        margin: auto;
        background-color: #222; /* Fundo monocromático */
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
        overflow-y: auto;
        height: 500px;
    }

    h2 {
        color: #fff; 
        margin: 0 0 10px 0;
        text-align: center;
    }

    .message {
        display: flex;
        align-items: center;
        padding: 10px;
        border-radius: 5px;
        animation: fadeIn 0.5s ease-in-out;
        position: relative;
    }

    .message.user {
        justify-content: flex-end;
        background-color: #333; 
        color: #fff;
    }

    .message.bot {
        justify-content: flex-start;
        background-color: #444; 
        color: #fff;
    }

    .message-content {
        max-width: 60%;
        padding: 15px;
        border-radius: 5px;
        background-color: rgba(255, 255, 255, 0.1); 
        word-wrap: break-word;
    }

    .timestamp {
        font-size: 0.75em;
        color: #aaaaaa; 
        position: absolute;
        bottom: -15px;
        right: 10px;
    }

    .input-container {
        display: flex;
        margin-top: 10px;
    }

    .input {
        flex: 1;
        padding: 10px;
        border: 1px solid #CCC; 
        border-radius: 5px;
        color: #fff;
        background-color: #222; 
    }

    .send-button {
        background-color: #ccc; 
        color: #000;
        padding: 10px 15px;
        border: none;
        border-radius: 5px;
        margin-left: 10px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .send-button:hover {
        background-color: #ccc; 
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
