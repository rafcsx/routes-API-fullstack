<script lang="ts">
    import { onMount } from 'svelte';
    import { initializeApp } from "firebase/app";
    import { getDatabase, ref, set, onValue } from "firebase/database";

    const firebaseConfig = {
        apiKey: "AIzaSyA7bdsMRoNvLc1fGk84tjjCzy8jQgT2VLc",
        authDomain: "svelte-blip-chatbo.firebaseapp.com",
        databaseURL: "https://svelte-blip-chatbo-default-rtdb.firebaseio.com",
        projectId: "svelte-blip-chatbo",
        storageBucket: "svelte-blip-chatbo.appspot.com",
        messagingSenderId: "494627128433",
        appId: "1:494627128433:web:99099a19db8eee632687d0"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    let messages = [];
    let newMessage = '';

    function fetchChatLogs() {
        const messagesRef = ref(db, 'messages');
        onValue(messagesRef, (snapshot) => {
            messages = [];
            snapshot.forEach((childSnapshot) => {   
                const messageData = childSnapshot.val();
                messages.push({
                    content: messageData.content,
                    from: messageData.from,
                    timestamp: messageData.timestamp
                });
            });
            scrollToBottom();
        });
    }

    async function sendMessage() {
        if (newMessage.trim() === '') return;

        const messageData = {
            content: newMessage,
            from: 'Você',
            timestamp: Date.now(),
        };

        try {
            const messageRef = ref(db, 'messages/' + Date.now());
            await set(messageRef, messageData);
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

            newMessage = '';
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }

    onMount(() => {
        fetchChatLogs();
        initBlipChat();
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

<div class="chat-container bg-gray-800 p-4 rounded-lg shadow-lg max-w-md mx-auto h-96 flex flex-col">
    <h2 class="text-white text-xl text-center mb-4">Conversa</h2>
    <div class="messages flex-1 overflow-y-auto">
        {#each messages as message}
            <div class={`message p-2 rounded-lg mb-2 ${message.from === 'Você' ? 'bg-gray-600 text-white self-end' : 'bg-gray-700 text-white self-start'}`}>
                <div class="message-content break-words">
                    {message.content}
                </div>
                <div class="timestamp text-xs text-gray-400 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</div>
            </div>
        {/each}
    </div>
    
    <div class="input-container mt-2 flex">
        <input type="text" bind:value={newMessage} placeholder="Digite sua mensagem..." class="input flex-1 p-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none" />
        <button on:click={sendMessage} class="send-button bg-blue-500 text-white p-2 rounded-lg ml-2 hover:bg-blue-600 transition duration-200">Enviar</button>
    </div>
</div>

<style>
 body {
    display: flex; /* Usar flexbox para centralizar o conteúdo */
    justify-content: center; /* Centraliza horizontalmente */
    align-items: center; /* Centraliza verticalmente */
    height: 100vh; /* Faz a altura ocupar toda a janela */
    margin: 0; /* Remove margens padrão do body */
    background-color: #111; /* Cor de fundo da página */
}

.chat-panel {
    width: 400px; /* Largura fixa para o painel */
    height: 400px; /* Altura fixa para manter a forma quadrada */
    background-color: #222; 
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
    overflow: hidden; /* Oculta o conteúdo que excede os limites do painel */
}

h2 {
    color: #fff; 
    margin: 0;
    text-align: center;
    padding: 1rem;
    background-color: #333;
}

.chat-container {
    display: flex;
    flex-direction: column;
    gap: 10px; /* Espaçamento entre as mensagens */
    padding: 1rem;
    height: calc(100% - 80px); /* Altura ajustada para o painel, subtraindo a altura do título e entrada */
    overflow-y: auto; /* Permite rolagem se o conteúdo exceder a altura */
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
    max-width: 60%; /* Limita a largura das mensagens */
    padding: 15px;
    border-radius: 5px;
    background-color: rgba(255, 255, 255, 0.1); 
    word-wrap: break-word; /* Quebra a linha do texto longo */
}

.timestamp {
    font-size: 0.75em;
    color: #aaaaaa; 
    position: absolute;
    bottom: -15px;
    right: 10px; /* Ajusta a posição do timestamp */
}

.input-container {
    display: flex;
    margin-top: 10px;
    padding: 10px; /* Espaçamento interno */
}

.input {
    flex: 1; /* Faz o campo de entrada ocupar o espaço restante */
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
    margin-left: 10px; /* Espaçamento à esquerda do botão */
    cursor: pointer;
    transition: background-color 0.3s;
}

.send-button:hover {
    background-color: #bbb; 
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
