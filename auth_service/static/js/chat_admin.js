// chat_admin.js

let allUsers = [];       // список всех пользователей (id, name, email)
let currentAdminId = null; // id текущего админа (берём из токена или localStorage)

/**
 * Инициализация после загрузки DOM
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Предположим, у вас есть функция getTokenFromDatabase() + localStorage user_id
    token = await getTokenFromDatabase();
    currentAdminId = localStorage.getItem('user_id');

    if (!token) {
        console.error("Нет валидного токена. Переходим на логин");
        window.location.href = "/login";
        return;
    }

    // Кнопка «Создать чат»
    document.getElementById('create-chat-btn').addEventListener('click', openCreateChatModal);

    // Форма создания чата
    document.getElementById('create-chat-form').addEventListener('submit', createChat);

    // Форма добавления участников
    document.getElementById('add-participants-form').addEventListener('submit', addParticipantsToChat);

    // Для отображения пользователей в списке
    await fetchAllUsers();
});

/**
 * Получаем список всех пользователей (GET /users/).
 */
async function fetchAllUsers() {
    try {
        const response = await fetch('/users/', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            console.error("Не удалось получить список пользователей", response.status);
            return;
        }
        allUsers = await response.json(); // массив {id, name, email, role}
    } catch (err) {
        console.error("Ошибка fetchAllUsers:", err);
    }
}

/**
 * Открыть модалку для создания нового чата:
 *  - Заполняем <select id="participants-select"> списком пользователей, исключая самого админа? (по желанию)
 */
function openCreateChatModal() {
    // Очищаем поля
    document.getElementById('chat-name-input').value = '';
    document.getElementById('is-group-checkbox').checked = false;

    const select = document.getElementById('participants-select');
    select.innerHTML = '';
    // Заполняем <option>
    allUsers.forEach(user => {
        // Если хотим исключить самого себя из выбора – расскоментить ниже
        // if (user.id === currentAdminId) return;
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name + ` (${user.email})`;
        select.appendChild(option);
    });

    // Показываем модальное окно (Bootstrap 5)
    const modal = new bootstrap.Modal(document.getElementById('createChatModal'));
    modal.show();
}

/**
 * createChat – обработчик формы #create-chat-form (POST /chats/)
 */
async function createChat(event) {
    event.preventDefault();

    const chatName = document.getElementById('chat-name-input').value.trim();
    const isGroup = document.getElementById('is-group-checkbox').checked;
    const select = document.getElementById('participants-select');
    const selectedOptions = Array.from(select.selectedOptions).map(opt => opt.value);

    // Список участников:
    // Добавляем самого админа + выбранные
    const participants = new Set(selectedOptions); // убираем дубликаты
    participants.add(currentAdminId); // admin автоматически

    // Формируем запрос
    const bodyData = {
        name: chatName,
        is_group: isGroup,
        participants: Array.from(participants) // convert Set -> Array
    };

    try {
        const response = await fetch(`http://${window.location.hostname}:8004/chats/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(bodyData)
        });
        if (!response.ok) {
            const errData = await response.json();
            console.error("Ошибка создания чата:", errData.detail || response.statusText);
            alert(`Ошибка создания чата: ${errData.detail || response.statusText}`);
            return;
        }
        const newChat = await response.json();
        alert(`Чат "${newChat.name}" успешно создан! ID: ${newChat.id}`);

        // Закрываем модалку
        const modalEl = document.getElementById('createChatModal');
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        bsModal.hide();

        // Можно обновить список чатов в UI (если есть функция refreshChatList())
        // await refreshChatList(); 
    } catch (err) {
        console.error("Ошибка при создании чата:", err);
        alert("Ошибка при создании чата (см. консоль)");
    }
}

/**
 * Открываем модалку «добавить участников», запоминаем chat_id
 * Вызывается, например, из кнопки «Добавить участников» рядом с каждым чатом
 */
async function openAddParticipantsModal(chatId) {
    document.getElementById('hidden-chat-id').value = chatId;

    let currentParticipantIds = [];
    try {
        const resp = await fetch(`http://${window.location.hostname}:8004/chats/${chatId}`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!resp.ok) {
            console.error("Не удалось получить чат:", resp.status);
            alert("Ошибка получения чата (см. консоль)");
            return;
        }
        const chatData = await resp.json();
        // chatData.participants = массив строк user_id
        currentParticipantIds = chatData.participants || [];
    } catch (err) {
        console.error("Ошибка при запросе чата:", err);
        return;
    }

    const select = document.getElementById('add-participants-select');
    select.innerHTML = '';

    // Заполняем списком всех пользователей (или фильтруем участников?)
    allUsers.forEach(user => {
        if (!currentParticipantIds.includes(user.id)) {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (${user.email})`;
            select.appendChild(option);
        }
    });

    const modal = new bootstrap.Modal(document.getElementById('addParticipantsModal'));
    modal.show();
}

/**
 * Добавить выбранных участников (PATCH /chats/add_user)
 * Эта логика добавляет по одному участнику
 * (или можно цикл и вызывать PATCH несколько раз)
 */
async function addParticipantsToChat(event) {
    event.preventDefault();

    const chatId = document.getElementById('hidden-chat-id').value;
    const select = document.getElementById('add-participants-select');
    const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);

    for (const userToAdd of selectedIds) {
        await addOneUserToChat(chatId, userToAdd);
    }

    // Закрываем модалку
    const modalEl = document.getElementById('addParticipantsModal');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    bsModal.hide();

    alert('Участники добавлены в чат!');
}

async function addOneUserToChat(chatId, userId) {
    // PATCH /chats/add_user?chat_id=...&user_id=...
    const url = `http://${window.location.hostname}:8004/chats/add_user?chat_id=${chatId}&user_id=${userId}`;
    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!response.ok) {
            const errData = await response.json();
            console.error("Ошибка добавления пользователя:", errData.detail || response.statusText);
            // Можно не прерываться, а продолжить добавлять остальных
        }
    } catch (err) {
        console.error("Ошибка addOneUserToChat:", err);
    }
}

/**
 * Пример заглушки getTokenFromDatabase()
 */
async function getTokenFromDatabase() {
    // Заглядывает в localStorage или делает запрос /get-user-token/{userId}
    // Возвращает строку токена
    return localStorage.getItem('access_token');
}