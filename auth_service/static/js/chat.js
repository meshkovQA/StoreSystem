//chat.js
const chatListEl = document.getElementById('chat-list');
const chatContainerEl = document.getElementById('chat-container');
const chatTitleEl = document.getElementById('chat-title');
const chatMessagesEl = document.getElementById('chat-messages');
const loadHistoryBtn = document.getElementById('load-history-btn');
const messageInputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

const userNamesCache = {};

const userId = localStorage.getItem("user_id");

let currentChatId = null;
let currentChatWebSocket = null;

let token = null;

// 1. При загрузке страницы запрашиваем список чатов
document.addEventListener('DOMContentLoaded', async () => {
    const token = await getTokenFromDatabase();

    if (!token) {
        console.error("Токен недействителен, перенаправление на страницу логина");
        window.location.href = "/login";
        return;
    }
    await fetchChats(token);
});



// Функция запроса списка чатов (REST GET /chats/)
async function fetchChats(token) {
    try {
        const response = await fetch(`http://${window.location.hostname}:8004/chats/`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.log('Ошибка при получении чатов', response.status);
            return;
        }
        const chats = await response.json();
        renderChatList(chats);
    } catch (err) {
        console.error('Ошибка fetchChats', err);
    }
}

// Отображение списка чатов
function renderChatList(chats) {
    chatListEl.innerHTML = '';

    chats.forEach(chat => {
        // Создаём <li class="... d-flex justify-content-between ...">
        const li = document.createElement('li');
        li.classList.add(
            'list-group-item',
            'chat-list-item',
            'd-flex',
            'justify-content-between',
            'align-items-center'
        );

        // ----- ЛЕВАЯ ЧАСТЬ (название чата) -----
        const chatNameSpan = document.createElement('span');
        chatNameSpan.textContent = chat.name || 'Без названия';

        // Клик по названию открывает чат
        chatNameSpan.addEventListener('click', () => {
            document.querySelectorAll('.chat-list-item.active')
                .forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            openChat(chat.id, chat.name);
        });

        li.appendChild(chatNameSpan);

        // ----- ПРАВАЯ ЧАСТЬ (кнопка) -----
        // Кнопка «Добавить участников»
        const btnAdd = document.createElement('button');
        btnAdd.textContent = "Добавить участников";
        btnAdd.classList.add('btn', 'btn-sm', 'btn-outline-primary', 'btn-add-participants');
        // по умолчанию скрыта
        btnAdd.style.display = 'none';

        // Если user — супер-админ
        if (window.isSuperAdmin === true) {
            btnAdd.style.display = 'block';
        }

        btnAdd.addEventListener('click', (event) => {
            event.stopPropagation();
            openAddParticipantsModal(chat.id);
        });
        li.appendChild(btnAdd);

        chatListEl.appendChild(li);
    });
}

// Функция открытия чата
async function openChat(chatId, chatName) {
    currentChatId = chatId;
    chatTitleEl.textContent = chatName || 'Без названия';
    chatMessagesEl.innerHTML = '';
    chatContainerEl.style.display = 'block';

    // Если был старый WebSocket, отключаем все его колбэки, чтобы он не обнулил currentChatWebSocket
    if (currentChatWebSocket) {
        console.log("[WS] Закрываем предыдущее соединение...");
        currentChatWebSocket.onclose = null;
        currentChatWebSocket.onerror = null;
        currentChatWebSocket.onmessage = null;
        currentChatWebSocket.onopen = null;
        currentChatWebSocket.close();
    }


    // Создаём новое соединение
    const wsUrl = `ws://${window.location.hostname}:8004/ws/${chatId}/${userId}`;
    console.log(`[WS] Подключаемся к: ${wsUrl}`);
    currentChatWebSocket = new WebSocket(wsUrl);

    currentChatWebSocket.onopen = () => {
        console.log(`[WS] onopen. Подключено к чату: ${chatId}`);
    };

    currentChatWebSocket.onerror = (event) => {
        console.log("[WS] onerror:", event);
    };

    currentChatWebSocket.onclose = (event) => {
        console.log(`[WS] onclose. Код: ${event.code}, причина: ${event.reason}`);
        currentChatWebSocket = null;
    };

    // Колбэк при получении сообщения
    currentChatWebSocket.onmessage = (event) => {
        console.log("[WS] onmessage с данными:", event.data);
        const messageObj = JSON.parse(event.data);

        // 1) Ставим «заглушку» для имени (или "Вы", если это наш)
        if (messageObj.sender_id === userId) {
            messageObj.sender_name = "Вы";
        } else {
            // Или ставим временно "User {id}"
            messageObj.sender_name = `User ${messageObj.sender_id}`;
        }

        // 2) Добавляем сообщение сразу – в порядке приёма
        addMessageToChat(messageObj);

        // 3) Если это не наше сообщение, параллельно запрашиваем имя...
        if (messageObj.sender_id !== userId) {
            fetchUserNameById(messageObj.sender_id).then(realName => {
                if (realName && realName !== messageObj.sender_id) {
                    // 4) Когда имя получено, обновляем уже отображённое сообщение
                    updateBubbleName(messageObj.id, realName);
                }
            });
        }
    };
}

// Добавить сообщение в DOM
// messageObj = { id, chat_id, sender_id, content, created_at, ... }
function addMessageToChat(messageObj) {
    const isOutgoing = (messageObj.sender_id === userId);
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('message-bubble', isOutgoing ? 'outgoing' : 'incoming');

    bubbleDiv.dataset.messageId = messageObj.id;

    const dateString = new Date(messageObj.created_at).toLocaleString();
    bubbleDiv.innerHTML = `
      <div class="message-info">
        <strong class="sender-name">${messageObj.sender_name}</strong>, ${dateString}
      </div>
      <div>${messageObj.content}</div>
    `;
    chatMessagesEl.appendChild(bubbleDiv);

    // Автопрокрутка в самый низ
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function updateBubbleName(messageId, newName) {
    // Ищем bubble, у которого data-message-id = messageId
    const bubble = [...document.querySelectorAll('.message-bubble')]
        .find(el => el.dataset.messageId === messageId);
    if (!bubble) return; // уже не нашли – значит пользователь мог очистить историю

    // Меняем имя
    const nameEl = bubble.querySelector('.sender-name');
    if (nameEl) {
        nameEl.textContent = newName;
    }
}

// При клике "Показать историю" — запрос к REST GET /chats/{chat_id}/messages
loadHistoryBtn.addEventListener('click', async () => {
    if (!currentChatId) return;
    try {
        const response = await fetch(`http://${window.location.hostname}:8004/chats/${currentChatId}/messages`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.log('Ошибка при получении истории', response.status);
            return;
        }
        const allMessages = await response.json();
        // Очищаем окно чата и добавляем все сообщения заново
        chatMessagesEl.innerHTML = '';

        for (const msg of allMessages) {
            // Если сообщение наше
            if (msg.sender_id === userId) {
                msg.sender_name = "Вы";
            } else {
                // Запрашиваем имя пользователя
                msg.sender_name = await fetchUserNameById(msg.sender_id);
            }
            addMessageToChat(msg);
        }
    } catch (err) {
        console.error('Ошибка loadHistory', err);
    }
});

// Отправка нового сообщения
sendBtn.addEventListener('click', () => {
    sendMessage();
});
messageInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    // Логируем состояние
    if (!currentChatWebSocket) {
        console.log("[WS] sendMessage: currentChatWebSocket = null");
        alert('WebSocket не подключен');
        return;
    }

    console.log(`[WS] readyState: ${currentChatWebSocket.readyState}`);
    // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED

    if (currentChatWebSocket.readyState !== WebSocket.OPEN) {
        console.log("[WS] Не OPEN, отправка невозможна.");
        alert('WebSocket не подключен');
        return;
    }

    const text = messageInputEl.value.trim();
    if (!text) return;

    // Отправляем JSON
    console.log(`[WS] Отправляем сообщение: "${text}"`);
    const payload = JSON.stringify({ content: text });
    currentChatWebSocket.send(payload);

    // Очищаем инпут
    messageInputEl.value = '';
}

async function fetchUserNameById(userId) {
    if (!userId) return null;
    // Если есть в кэше — берём из него
    if (userNamesCache[userId]) {
        return userNamesCache[userId];
    }
    try {
        const response = await fetch(`/user_name/${userId}`);
        if (!response.ok) {
            console.log("Не удалось получить имя для", userId, response.status);
            return userId; // fallback: вернём сам userId
        }
        const data = await response.json();
        userNamesCache[userId] = data.name;  // кэшируем
        return data.name;
    } catch (err) {
        console.error("Ошибка fetchUserNameById", err);
        return userId;
    }
}