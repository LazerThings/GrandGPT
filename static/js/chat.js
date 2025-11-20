// State management
let currentChatId = null;
let chats = [];
let isLoading = false;

// DOM elements
const chatList = document.getElementById('chatList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const chatTitle = document.getElementById('chatTitle');
const confirmModal = document.getElementById('confirmModal');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');

// Configure marked for GFM
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false
});

// Initialize
loadChats();

// Event listeners
newChatBtn.addEventListener('click', createNewChat);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
});

// Settings modal
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

// Confirmation modal
confirmCancelBtn.addEventListener('click', () => {
    confirmModal.classList.remove('active');
});

confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        confirmModal.classList.remove('active');
    }
});

// Functions
async function loadChats() {
    try {
        const response = await fetch('/api/chats');
        chats = await response.json();
        renderChatList();
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

function renderChatList() {
    chatList.innerHTML = '';

    if (chats.length === 0) {
        chatList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 14px;">No chats yet</div>';
        return;
    }

    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        if (chat.id === currentChatId) {
            chatItem.classList.add('active');
        }

        chatItem.innerHTML = `
            <div class="chat-item-title">${escapeHtml(chat.title)}</div>
            <button class="chat-item-delete" data-chat-id="${chat.id}" title="Delete chat">
                <i class="ph-light ph-trash-simple"></i>
            </button>
        `;

        chatItem.addEventListener('click', (e) => {
            // Don't load chat if clicking delete button or its icon
            if (!e.target.closest('.chat-item-delete')) {
                loadChat(chat.id);
            }
        });

        const deleteBtn = chatItem.querySelector('.chat-item-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        chatList.appendChild(chatItem);
    });
}

async function createNewChat() {
    try {
        const response = await fetch('/api/chats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const newChat = await response.json();
        chats.unshift(newChat);
        renderChatList();
        loadChat(newChat.id);
    } catch (error) {
        console.error('Error creating chat:', error);
    }
}

async function loadChat(chatId) {
    try {
        const response = await fetch(`/api/chats/${chatId}`);
        const chat = await response.json();

        currentChatId = chatId;
        chatTitle.textContent = chat.title;
        renderChatList();
        renderMessages(chat.messages);
        messageInput.focus();
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

function renderMessages(messages) {
    messagesContainer.innerHTML = '';

    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Start a conversation</h2>
                <p>Type your message below to begin.</p>
            </div>
        `;
        return;
    }

    messages.forEach(message => {
        appendMessage(message.role, message.content);
    });

    scrollToBottom();
}

function appendMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = role === 'user' ? 'You' : 'Claude';

    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    // Render markdown for all messages (both user and assistant)
    messageText.innerHTML = marked.parse(content);

    contentDiv.appendChild(header);
    contentDiv.appendChild(messageText);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
}

async function sendMessage() {
    if (isLoading) return;

    const message = messageInput.value.trim();
    if (!message) return;

    // Create a new chat if none is selected
    if (!currentChatId) {
        await createNewChat();
        // Wait a bit for the chat to be created
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!currentChatId) {
        console.error('No chat selected');
        return;
    }

    // Clear input and disable send button
    messageInput.value = '';
    messageInput.style.height = 'auto';
    isLoading = true;
    sendBtn.disabled = true;

    // Show user message immediately
    appendMessage('user', message);
    scrollToBottom();

    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loading-message';
    loadingDiv.innerHTML = `
        <div class="message-header">Claude</div>
        <div class="message-content">Thinking...</div>
    `;
    messagesContainer.appendChild(loadingDiv);
    scrollToBottom();

    try {
        const response = await fetch(`/api/chats/${currentChatId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const data = await response.json();

        // Remove loading indicator
        const loading = document.getElementById('loading-message');
        if (loading) {
            loading.remove();
        }

        // Show assistant response
        appendMessage('assistant', data.assistant_message.content);
        scrollToBottom();

        // Update chat title if changed
        if (data.chat_title) {
            chatTitle.textContent = data.chat_title;
            const chatInList = chats.find(c => c.id === currentChatId);
            if (chatInList) {
                chatInList.title = data.chat_title;
                renderChatList();
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);

        // Remove loading indicator
        const loading = document.getElementById('loading-message');
        if (loading) {
            loading.remove();
        }

        // Show error message
        appendMessage('assistant', 'Sorry, there was an error processing your message. Please try again.');
        scrollToBottom();
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

function deleteChat(chatId) {
    // Show confirmation modal
    document.getElementById('confirmTitle').textContent = 'Delete Chat';
    document.getElementById('confirmMessage').textContent = 'Are you sure you want to delete this chat? This action cannot be undone.';
    confirmModal.classList.add('active');

    // Remove any existing click handlers by cloning the button
    const oldOkBtn = document.getElementById('confirmOkBtn');
    const newOkBtn = oldOkBtn.cloneNode(true);
    oldOkBtn.parentNode.replaceChild(newOkBtn, oldOkBtn);

    // Add new click handler for this specific delete
    newOkBtn.addEventListener('click', async () => {
        confirmModal.classList.remove('active');

        try {
            await fetch(`/api/chats/${chatId}`, {
                method: 'DELETE'
            });

            chats = chats.filter(c => c.id !== chatId);

            if (currentChatId === chatId) {
                currentChatId = null;
                chatTitle.textContent = 'GrandGPT';
                messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <h2>Welcome to GrandGPT!</h2>
                        <p>Start a new chat to begin conversing.</p>
                    </div>
                `;
            }

            renderChatList();
        } catch (error) {
            console.error('Error deleting chat:', error);
        }
    });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
