let token = '';
let conversations = [];
let filteredConversations = [];
let currentConversation = null;
let messages = [];
let filteredMessages = [];
let currentFilter = 'all';
let sortOrder = 'asc';

async function loadConversations() {
    token = document.getElementById('tokenInput').value.trim();
    const errorDiv = document.getElementById('tokenError');
    
    if (!token) {
        errorDiv.textContent = 'Please enter a token';
        errorDiv.classList.remove('hidden');
        return;
    }

    errorDiv.classList.add('hidden');
    showLoading('tokenSection');

    try {
        const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 
                'Authorization': token
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token - please check your token and try again');
        }

        const userData = await userResponse.json();
        console.log('Logged in as:', userData.username);

        const response = await fetch('https://discord.com/api/v10/users/@me/channels', {
            headers: { 
                'Authorization': token
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch conversations');
        }

        const allChannels = await response.json();
        
        // Filter out bot DMs (type 0 is text channels, we only want 1=DM and 3=Group DM)
        conversations = allChannels.filter(function(channel) {
            return channel.type === 1 || channel.type === 3;
        });

        filteredConversations = conversations;
        displayConversations();
    } catch (err) {
        console.error('Full error:', err);
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
        hideLoading('tokenSection');
    }
}

function setFilter(filter) {
    currentFilter = filter;
    
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(function(tab) {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    filterConversations();
}

function filterConversations() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredConversations = conversations.filter(function(convo) {
        // Apply type filter
        if (currentFilter === 'dm' && convo.type !== 1) return false;
        if (currentFilter === 'group' && convo.type !== 3) return false;
        
        // Apply search filter
        if (searchTerm) {
            const name = getConvoName(convo).toLowerCase();
            return name.indexOf(searchTerm) !== -1;
        }
        
        return true;
    });
    
    displayConversations();
}

function displayConversations() {
    document.getElementById('tokenSection').classList.add('hidden');
    document.getElementById('conversationsSection').classList.remove('hidden');
    
    const list = document.getElementById('conversationsList');
    list.innerHTML = '';

    if (filteredConversations.length === 0) {
        list.innerHTML = '<div class="loading">No conversations found</div>';
        return;
    }

    filteredConversations.forEach(function(convo) {
        const name = getConvoName(convo);
        const type = getConvoType(convo);
        const initial = name[0].toUpperCase();

        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.onclick = function() { selectConversation(convo); };
        item.innerHTML = '<div class="conversation-icon">' + initial + '</div><div class="conversation-info"><div class="conversation-name">' + escapeHtml(name) + '</div><div class="conversation-type">' + type + '</div></div>';
        list.appendChild(item);
    });
}

async function selectConversation(convo) {
    currentConversation = convo;
    document.getElementById('conversationsSection').classList.add('hidden');
    document.getElementById('messagesSection').classList.remove('hidden');
    document.getElementById('conversationTitle').textContent = getConvoName(convo);
    
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '<div class="loading">Loading messages...</div>';

    try {
        await fetchMessages(convo.id);
        filteredMessages = messages;
        updateMessageCount();
        displayMessages();
    } catch (err) {
        container.innerHTML = '<div class="error">Failed to load messages: ' + err.message + '</div>';
    }
}

async function fetchMessages(channelId) {
    messages = [];
    let lastId = null;

    while (true) {
        let url = 'https://discord.com/api/v10/channels/' + channelId + '/messages?limit=100';
        if (lastId) {
            url = url + '&before=' + lastId;
        }

        const response = await fetch(url, {
            headers: { 
                'Authorization': token
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch messages');
        }

        const batch = await response.json();
        if (batch.length === 0) break;

        messages = messages.concat(batch);
        lastId = batch[batch.length - 1].id;

        if (batch.length < 100) break;
    }

    messages.reverse();
}

function searchMessages() {
    const searchTerm = document.getElementById('messageSearch').value.toLowerCase();
    
    if (!searchTerm) {
        filteredMessages = messages;
    } else {
        filteredMessages = messages.filter(function(msg) {
            const content = msg.content.toLowerCase();
            const author = msg.author.username.toLowerCase();
            return content.indexOf(searchTerm) !== -1 || author.indexOf(searchTerm) !== -1;
        });
    }
    
    updateMessageCount();
    displayMessages();
}

function changeSortOrder() {
    sortOrder = document.getElementById('sortOrder').value;
    displayMessages();
}

function updateMessageCount() {
    const countEl = document.getElementById('messageCount');
    countEl.textContent = filteredMessages.length + ' messages';
}

function displayMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';

    if (filteredMessages.length === 0) {
        container.innerHTML = '<div class="loading">No messages found</div>';
        return;
    }

    const messagesToDisplay = sortOrder === 'desc' ? [...filteredMessages].reverse() : filteredMessages;

    messagesToDisplay.forEach(function(msg) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';

        const initial = msg.author.username[0].toUpperCase();
        const timestamp = formatTimestamp(msg.timestamp);

        let html = '<div class="message-header"><div class="avatar">' + initial + '</div><div class="message-info"><div class="message-author">' + escapeHtml(msg.author.username) + '</div><div class="message-time">' + timestamp + '</div></div></div>';

        if (msg.content) {
            html += '<div class="message-content">' + escapeHtml(msg.content) + '</div>';
        }

        if (msg.attachments && msg.attachments.length > 0) {
            html += '<div class="attachments">';
            msg.attachments.forEach(function(att) {
                html += '<a href="' + att.url + '" target="_blank" class="attachment">File: ' + escapeHtml(att.filename) + '</a>';
            });
            html += '</div>';
        }

        if (msg.embeds && msg.embeds.length > 0) {
            msg.embeds.forEach(function(emb) {
                html += '<div class="embed">';
                if (emb.title) {
                    html += '<div class="embed-title">' + escapeHtml(emb.title) + '</div>';
                }
                if (emb.description) {
                    html += '<div class="embed-description">' + escapeHtml(emb.description) + '</div>';
                }
                if (emb.url) {
                    html += '<a href="' + emb.url + '" target="_blank" class="attachment">Link</a>';
                }
                html += '</div>';
            });
        }

        if (msg.reactions && msg.reactions.length > 0) {
            html += '<div class="reactions">';
            msg.reactions.forEach(function(react) {
                html += '<span class="reaction">' + react.emoji.name + ' ' + react.count + '</span>';
            });
            html += '</div>';
        }

        msgDiv.innerHTML = html;
        container.appendChild(msgDiv);
    });
}

function downloadConversation() {
    if (messages.length === 0) return;

    const formatted = messages.map(function(msg) {
        return {
            timestamp: new Date(msg.timestamp).toISOString(),
            author: msg.author.username,
            authorId: msg.author.id,
            content: msg.content,
            attachments: (msg.attachments || []).map(function(att) {
                return {
                    filename: att.filename,
                    url: att.url,
                    size: att.size,
                    contentType: att.content_type
                };
            }),
            embeds: (msg.embeds || []).map(function(emb) {
                return {
                    title: emb.title,
                    description: emb.description,
                    url: emb.url
                };
            }),
            reactions: (msg.reactions || []).map(function(r) {
                return {
                    emoji: r.emoji.name,
                    count: r.count
                };
            })
        };
    });

    const convoName = getConvoName(currentConversation).replace(/[^a-z0-9]/gi, '_');
    const blob = new Blob([JSON.stringify(formatted, null, 2)], { type: 'application/json' });
    downloadFile(blob, convoName + '_export.json');
}

function exportAsText() {
    if (messages.length === 0) return;

    let text = 'Conversation: ' + getConvoName(currentConversation) + '\n';
    text += 'Exported: ' + new Date().toISOString() + '\n';
    text += '='.repeat(60) + '\n\n';

    messages.forEach(function(msg) {
        text += '[' + formatTimestamp(msg.timestamp) + '] ' + msg.author.username + ':\n';
        text += msg.content + '\n';
        
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(function(att) {
                text += '  [Attachment: ' + att.filename + ' - ' + att.url + ']\n';
            });
        }
        
        text += '\n';
    });

    const convoName = getConvoName(currentConversation).replace(/[^a-z0-9]/gi, '_');
    const blob = new Blob([text], { type: 'text/plain' });
    downloadFile(blob, convoName + '_export.txt');
}

function exportAsHTML() {
    if (messages.length === 0) return;

    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escapeHtml(getConvoName(currentConversation)) + '</title>';
    html += '<style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e4e4e7;}';
    html += '.message{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:15px;margin-bottom:15px;}';
    html += '.author{font-weight:600;color:#fff;margin-bottom:5px;}.time{color:#71717a;font-size:0.85rem;margin-bottom:10px;}';
    html += '.content{line-height:1.6;color:#d4d4d8;}.attachment{color:#a1a1aa;text-decoration:none;}</style></head><body>';
    html += '<h1>' + escapeHtml(getConvoName(currentConversation)) + '</h1>';
    html += '<p style="color:#71717a;">Exported: ' + new Date().toLocaleString() + '</p><hr>';

    messages.forEach(function(msg) {
        html += '<div class="message">';
        html += '<div class="author">' + escapeHtml(msg.author.username) + '</div>';
        html += '<div class="time">' + formatTimestamp(msg.timestamp) + '</div>';
        html += '<div class="content">' + escapeHtml(msg.content).replace(/\n/g, '<br>') + '</div>';
        
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(function(att) {
                html += '<div><a class="attachment" href="' + att.url + '" target="_blank">Attachment: ' + escapeHtml(att.filename) + '</a></div>';
            });
        }
        
        html += '</div>';
    });

    html += '</body></html>';

    const convoName = getConvoName(currentConversation).replace(/[^a-z0-9]/gi, '_');
    const blob = new Blob([html], { type: 'text/html' });
    downloadFile(blob, convoName + '_export.html');
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function backToConversations() {
    document.getElementById('messagesSection').classList.add('hidden');
    document.getElementById('conversationsSection').classList.remove('hidden');
    currentConversation = null;
    messages = [];
    filteredMessages = [];
}

function getConvoName(convo) {
    if (convo.name) return convo.name;
    if (convo.recipients) {
        return convo.recipients.map(function(r) { return r.username; }).join(', ');
    }
    return 'Unknown';
}

function getConvoType(convo) {
    const types = {
        1: '1-on-1 DM',
        3: 'Group DM'
    };
    return types[convo.type] || 'DM';
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(sectionId) {
    const section = document.getElementById(sectionId);
    const btn = section.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Loading...';
}

function hideLoading(sectionId) {
    const section = document.getElementById(sectionId);
    const btn = section.querySelector('button');
    btn.disabled = false;
    btn.textContent = 'Load Conversations';
}