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
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const requestAccessBtn = document.getElementById('requestAccessBtn');
const displayNameInput = document.getElementById('displayNameInput');
const customApiKeyInput = document.getElementById('customApiKeyInput');

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

// Profile modal
profileBtn.addEventListener('click', () => {
    profileModal.classList.add('active');
});

closeProfileModalBtn.addEventListener('click', () => {
    profileModal.classList.remove('active');
});

profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        profileModal.classList.remove('active');
    }
});

saveProfileBtn.addEventListener('click', async () => {
    const displayName = displayNameInput.value.trim();
    const customApiKey = customApiKeyInput.value.trim();

    try {
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                display_name: displayName,
                custom_api_key: customApiKey
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Update the user data
            window.userData.displayName = displayName;

            // Update the profile button text
            profileBtn.querySelector('span').textContent = displayName || window.userData.username;

            // Show success message
            alert('Profile updated successfully!');
            profileModal.classList.remove('active');

            // Reload the page to update messages
            location.reload();
        } else {
            alert('Error: ' + (data.error || 'Failed to update profile'));
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile. Please try again.');
    }
});

requestAccessBtn.addEventListener('click', async () => {
    // Don't do anything if button is disabled
    if (requestAccessBtn.disabled) {
        return;
    }

    const displayName = displayNameInput.value.trim();

    try {
        const response = await fetch('/api/request-extended-access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                display_name: displayName
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Extended access request submitted successfully! An administrator will review your request.');
        } else {
            alert('Error: ' + (data.error || 'Failed to submit request'));
        }
    } catch (error) {
        console.error('Error requesting extended access:', error);
        alert('Failed to submit request. Please try again.');
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

// Close chat menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-item-menu') && !e.target.closest('.chat-item-menu-btn')) {
        document.querySelectorAll('.chat-item-menu.active').forEach(menu => {
            menu.classList.remove('active');
        });
    }

    // Close message overflow menus when clicking outside
    if (!e.target.closest('.message-overflow-dropdown') && !e.target.closest('.message-overflow-btn')) {
        document.querySelectorAll('.message-overflow-dropdown.active').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
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
            <button class="chat-item-menu-btn" data-chat-id="${chat.id}" title="Chat options">
                <i class="ph-light ph-dots-three-circle"></i>
            </button>
            <div class="chat-item-menu" data-chat-id="${chat.id}">
                <button class="chat-menu-option" data-action="rename">Rename</button>
                <button class="chat-menu-option chat-menu-delete" data-action="delete">Delete</button>
            </div>
        `;

        chatItem.addEventListener('click', (e) => {
            // Don't load chat if clicking menu button or menu options
            if (!e.target.closest('.chat-item-menu-btn') && !e.target.closest('.chat-item-menu')) {
                loadChat(chat.id);
            }
        });

        const menuBtn = chatItem.querySelector('.chat-item-menu-btn');
        const menu = chatItem.querySelector('.chat-item-menu');

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other menus
            document.querySelectorAll('.chat-item-menu.active').forEach(m => {
                if (m !== menu) m.classList.remove('active');
            });
            menu.classList.toggle('active');
        });

        // Handle menu options
        menu.querySelectorAll('.chat-menu-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = option.dataset.action;
                menu.classList.remove('active');

                if (action === 'delete') {
                    deleteChat(chat.id);
                } else if (action === 'rename') {
                    renameChat(chat.id, chat.title);
                }
            });
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
        appendMessage(message.role, message.content, message.id);
    });

    scrollToBottom();
}

function appendMessage(role, content, messageId = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    if (messageId) {
        messageDiv.dataset.messageId = messageId;
    }

    const borderDiv = document.createElement('div');
    borderDiv.className = 'message-border';

    // Add action buttons in the border
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';

    const buttons = role === 'user'
        ? [
            { action: 'copy', icon: 'ph-copy', title: 'Copy' },
            { action: 'edit', icon: 'ph-pencil-simple', title: 'Edit' },
            { action: 'regenerate', icon: 'ph-arrows-counter-clockwise', title: 'Regenerate' }
          ]
        : [
            { action: 'copy', icon: 'ph-copy', title: 'Copy' },
            { action: 'regenerate', icon: 'ph-arrows-counter-clockwise', title: 'Regenerate' }
          ];

    // Create regular buttons
    const regularButtons = document.createElement('div');
    regularButtons.className = 'message-regular-buttons';
    buttons.forEach(btn => {
        regularButtons.innerHTML += `
            <button class="message-action-btn" data-action="${btn.action}" title="${btn.title}">
                <i class="ph-light ${btn.icon}"></i>
            </button>
        `;
    });

    // Create overflow menu
    const overflowMenu = document.createElement('div');
    overflowMenu.className = 'message-overflow-menu';
    overflowMenu.style.display = 'none';
    overflowMenu.innerHTML = `
        <button class="message-overflow-btn" title="More actions">
            <i class="ph-light ph-dots-three"></i>
        </button>
        <div class="message-overflow-dropdown">
            ${buttons.map(btn => `
                <button class="message-overflow-option" data-action="${btn.action}">
                    <i class="ph-light ${btn.icon}"></i>
                    <span>${btn.title}</span>
                </button>
            `).join('')}
        </div>
    `;

    actionsDiv.appendChild(regularButtons);
    actionsDiv.appendChild(overflowMenu);
    borderDiv.appendChild(actionsDiv);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = role === 'user' ? (window.userData.displayName || 'You') : 'Claude';

    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    // Render markdown for all messages (both user and assistant)
    messageText.innerHTML = marked.parse(content);

    contentDiv.appendChild(header);
    contentDiv.appendChild(messageText);

    messageDiv.appendChild(borderDiv);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    // Add event listeners for regular action buttons
    regularButtons.querySelectorAll('.message-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.dataset.action;
            handleMessageAction(action, messageId, content, messageDiv);
        });
    });

    // Add event listeners for overflow menu
    const overflowBtn = overflowMenu.querySelector('.message-overflow-btn');
    const overflowDropdown = overflowMenu.querySelector('.message-overflow-dropdown');

    if (overflowBtn && overflowDropdown) {
        overflowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other overflow menus
            document.querySelectorAll('.message-overflow-dropdown.active').forEach(dropdown => {
                if (dropdown !== overflowDropdown) dropdown.classList.remove('active');
            });
            overflowDropdown.classList.toggle('active');
        });

        overflowDropdown.querySelectorAll('.message-overflow-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = option.dataset.action;
                overflowDropdown.classList.remove('active');
                handleMessageAction(action, messageId, content, messageDiv);
            });
        });
    }

    // Check if buttons fit, otherwise show overflow menu
    setTimeout(() => {
        const borderHeight = borderDiv.offsetHeight;
        const buttonsHeight = regularButtons.scrollHeight;

        // If buttons don't fit (with some padding for safety)
        if (buttonsHeight > borderHeight - 40) {
            regularButtons.style.display = 'none';
            overflowMenu.style.display = 'block';
        } else {
            regularButtons.style.display = 'flex';
            overflowMenu.style.display = 'none';
        }
    }, 0);
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

function handleMessageAction(action, messageId, content, messageDiv) {
    if (action === 'copy') {
        // Copy message content to clipboard
        navigator.clipboard.writeText(content).then(() => {
            // Show a brief success indicator
            const btn = messageDiv.querySelector(`[data-action="copy"]`);
            const originalColor = btn.style.color;
            btn.style.color = 'var(--primary-color)';
            setTimeout(() => {
                btn.style.color = originalColor;
            }, 500);
        });
    } else if (action === 'edit') {
        // Edit message - show input field
        const messageText = messageDiv.querySelector('.message-text');
        const currentText = content;

        // Create textarea for editing
        const textarea = document.createElement('textarea');
        textarea.className = 'message-edit-textarea';
        textarea.value = currentText;
        textarea.style.width = '100%';
        textarea.style.minHeight = '60px';
        textarea.style.padding = '8px';
        textarea.style.backgroundColor = 'var(--bg-black)';
        textarea.style.color = 'var(--text-primary)';
        textarea.style.border = '1px solid var(--primary-color)';
        textarea.style.borderRadius = '4px';
        textarea.style.fontFamily = 'inherit';
        textarea.style.fontSize = '14px';

        // Create save/cancel buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.marginTop = '8px';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'btn btn-primary';
        saveBtn.style.padding = '6px 12px';
        saveBtn.style.fontSize = '13px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.padding = '6px 12px';
        cancelBtn.style.fontSize = '13px';

        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);

        // Replace content with edit form
        messageText.innerHTML = '';
        messageText.appendChild(textarea);
        messageText.appendChild(buttonContainer);
        textarea.focus();

        cancelBtn.onclick = () => {
            messageText.innerHTML = marked.parse(currentText);
        };

        saveBtn.onclick = async () => {
            const newContent = textarea.value.trim();
            if (!newContent || newContent === currentText) {
                messageText.innerHTML = marked.parse(currentText);
                return;
            }

            // Update message and regenerate response
            try {
                const response = await fetch(`/api/messages/${messageId}/edit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: newContent })
                });

                const data = await response.json();

                // Reload chat to get updated messages
                await loadChat(currentChatId);
            } catch (error) {
                console.error('Error editing message:', error);
                messageText.innerHTML = marked.parse(currentText);
            }
        };
    } else if (action === 'regenerate') {
        // Regenerate response
        if (!messageId) return;

        regenerateResponse(messageId);
    }
}

async function regenerateResponse(messageId) {
    if (!currentChatId) return;

    try {
        const response = await fetch(`/api/messages/${messageId}/regenerate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        // Reload chat to show regenerated response
        await loadChat(currentChatId);
    } catch (error) {
        console.error('Error regenerating response:', error);
    }
}

function renameChat(chatId, currentTitle) {
    const newTitle = prompt('Enter new chat title:', currentTitle);
    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) {
        return;
    }

    fetch(`/api/chats/${chatId}/rename`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle.trim() })
    })
    .then(response => response.json())
    .then(data => {
        const chatInList = chats.find(c => c.id === chatId);
        if (chatInList) {
            chatInList.title = data.title;
            renderChatList();
            if (currentChatId === chatId) {
                chatTitle.textContent = data.title;
            }
        }
    })
    .catch(error => {
        console.error('Error renaming chat:', error);
    });
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
