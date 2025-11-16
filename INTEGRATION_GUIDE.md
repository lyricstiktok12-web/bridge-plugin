# Bridge Bot Integration Guide for External Applications

This guide explains how to integrate the Bridge Bot API into your external application or separate repository.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Integration Architectures](#integration-architectures)
- [Step-by-Step Tutorials](#step-by-step-tutorials)
- [Client Libraries](#client-libraries)
- [Common Use Cases](#common-use-cases)
- [Best Practices](#best-practices)

---

## Quick Start

### 1. Prerequisites

- Bridge Bot running with API enabled
- API endpoint accessible (default: `http://localhost:3000`)
- Valid JWT token or API key for authentication

### 2. Basic Connection Test

**Using cURL:**
```bash
# Test if API is accessible
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-16T10:30:00.000Z",...}
```

**Using JavaScript:**
```javascript
fetch('http://localhost:3000/api/health')
  .then(res => res.json())
  .then(data => console.log('API Status:', data))
  .catch(err => console.error('API Error:', err));
```

### 3. Authentication

```javascript
// Login to get a token
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'your-password'
  })
});

const { token } = await response.json();
// Store this token securely for future requests
```

### 4. Send Your First Message

```javascript
await fetch('http://localhost:3000/api/chat/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'Hello from my app!',
    channel: 'guild'
  })
});
```

---

## Integration Architectures

### Architecture 1: Web Dashboard (Recommended for Most)

```
┌─────────────────────────────────────┐
│     Your Frontend Application       │
│     (React/Vue/Angular/Next.js)     │
│                                     │
│  - Admin Dashboard                  │
│  - Real-time Chat Display           │
│  - Extension Management UI          │
└─────────────┬───────────────────────┘
              │ HTTP + WebSocket
              ↓
┌─────────────────────────────────────┐
│      Bridge Bot API Server          │
│      (Express + Socket.io)          │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│         Bridge Core                 │
│  (Discord ↔ Minecraft Bridge)       │
└─────────────────────────────────────┘
```

**Best for:**
- Admin dashboards
- Public chat viewers
- Extension management interfaces
- Real-time monitoring

**Example Stack:**
- Frontend: Next.js + TypeScript + TailwindCSS
- State: React Query for API data, Socket.io-client for real-time
- Auth: JWT stored in localStorage/cookies

### Architecture 2: Bot Integration

```
┌─────────────────────────────────────┐
│    Your Custom Discord/Telegram     │
│         /Slack Bot                  │
└─────────────┬───────────────────────┘
              │ REST API Calls
              ↓
┌─────────────────────────────────────┐
│      Bridge Bot API Server          │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│         Bridge Core                 │
└─────────────────────────────────────┘
```

**Best for:**
- Custom Discord bots that need guild chat access
- Multi-platform chat bridges
- Command relaying systems

**Example Flow:**
1. User sends `/guild hello` in Discord
2. Your bot catches the command
3. Bot calls Bridge API: `POST /api/chat/send`
4. Message appears in Minecraft guild chat

### Architecture 3: Analytics/Monitoring System

```
┌─────────────────────────────────────┐
│   Analytics Dashboard               │
│   (Grafana/Custom Dashboard)        │
└─────────────┬───────────────────────┘
              │ Periodic API Polling
              ↓
┌─────────────────────────────────────┐
│      Bridge Bot API Server          │
│                                     │
│  → Stores message history           │
│  → Provides stats endpoints         │
└─────────────┬───────────────────────┘
              │
              ↓
┌─────────────────────────────────────┐
│         Bridge Core                 │
└─────────────────────────────────────┘
```

**Best for:**
- Guild activity monitoring
- Message analytics
- Uptime tracking
- Extension performance monitoring

### Architecture 4: Database-Backed Application

```
┌─────────────────────────────────────┐
│    Your Application Backend         │
│    (Node.js/Python/Java/etc.)       │
└──────┬──────────────────────┬───────┘
       │                      │
       │ REST API        WebSocket (real-time)
       ↓                      ↓
┌─────────────────────────────────────┐
│      Bridge Bot API Server          │
└─────────────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│    Your Database                    │
│    (PostgreSQL/MongoDB/etc.)        │
│                                     │
│  - Store chat history long-term     │
│  - User analytics                   │
│  - Custom data processing           │
└─────────────────────────────────────┘
```

**Best for:**
- Long-term data storage
- Advanced analytics
- Custom data processing
- Multi-tenant systems

---

## Step-by-Step Tutorials

### Tutorial 1: Build a Simple Web Chat Viewer

**Goal:** Create a webpage that displays live guild chat messages.

**Tech Stack:** HTML + JavaScript + Socket.io

**Step 1: Create HTML file**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guild Chat Viewer</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #1a1a1a;
      color: #fff;
    }
    #chat {
      height: 500px;
      overflow-y: auto;
      border: 2px solid #333;
      padding: 15px;
      background: #2a2a2a;
      border-radius: 8px;
    }
    .message {
      margin: 10px 0;
      padding: 8px;
      border-radius: 4px;
      background: #333;
    }
    .minecraft { border-left: 4px solid #4CAF50; }
    .discord { border-left: 4px solid #5865F2; }
    .username { font-weight: bold; margin-right: 8px; }
    .timestamp { color: #888; font-size: 0.8em; margin-left: 8px; }
    #status {
      padding: 10px;
      margin-bottom: 20px;
      border-radius: 4px;
      background: #333;
    }
    .connected { color: #4CAF50; }
    .disconnected { color: #f44336; }
  </style>
</head>
<body>
  <h1>🌉 Guild Chat Viewer</h1>
  <div id="status">Status: <span id="status-text" class="disconnected">Disconnected</span></div>
  <div id="chat"></div>

  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

**Step 2: Create JavaScript file**

```javascript
// app.js
const BRIDGE_API = 'http://localhost:3000';
const TOKEN = 'your-jwt-token-here'; // Get this from login

const chatDiv = document.getElementById('chat');
const statusText = document.getElementById('status-text');

// Connect to WebSocket
const socket = io(BRIDGE_API);

socket.on('connect', () => {
  console.log('Connected to Bridge API');
  statusText.textContent = 'Connected';
  statusText.className = 'connected';
  
  // Authenticate
  socket.emit('authenticate', { token: TOKEN });
});

socket.on('authenticated', (data) => {
  if (data.success) {
    console.log('Authenticated successfully');
  } else {
    console.error('Authentication failed:', data.error);
    statusText.textContent = 'Authentication Failed';
    statusText.className = 'disconnected';
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from Bridge API');
  statusText.textContent = 'Disconnected';
  statusText.className = 'disconnected';
});

socket.on('chat_message', (message) => {
  addMessage(message);
});

function addMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${message.source}`;
  
  const timestamp = new Date(message.timestamp).toLocaleTimeString();
  
  messageDiv.innerHTML = `
    <span class="username">${message.username}</span>
    <span class="content">${escapeHtml(message.content)}</span>
    <span class="timestamp">${timestamp}</span>
  `;
  
  chatDiv.appendChild(messageDiv);
  chatDiv.scrollTop = chatDiv.scrollHeight; // Auto-scroll to bottom
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load message history
async function loadHistory() {
  try {
    const response = await fetch(`${BRIDGE_API}/api/chat/messages?limit=50`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    const data = await response.json();
    data.messages.forEach(addMessage);
  } catch (error) {
    console.error('Failed to load message history:', error);
  }
}

// Load history when page loads
loadHistory();
```

**Step 3: Run a local server**

```bash
# Install a simple HTTP server
npm install -g http-server

# Serve the files
http-server

# Open http://localhost:8080 in your browser
```

---

### Tutorial 2: Build a Discord Bot Integration

**Goal:** Create a Discord bot that sends messages to guild chat.

**Tech Stack:** Node.js + Discord.js

**Step 1: Install dependencies**

```bash
mkdir discord-bridge-bot
cd discord-bridge-bot
npm init -y
npm install discord.js axios dotenv
```

**Step 2: Create configuration**

```env
# .env
DISCORD_TOKEN=your_discord_bot_token
BRIDGE_API_URL=http://localhost:3000
BRIDGE_API_TOKEN=your_jwt_token
GUILD_CHAT_CHANNEL_ID=your_channel_id
```

**Step 3: Create the bot**

```javascript
// index.js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const BRIDGE_API = process.env.BRIDGE_API_URL;
const BRIDGE_TOKEN = process.env.BRIDGE_API_TOKEN;
const GUILD_CHANNEL = process.env.GUILD_CHAT_CHANNEL_ID;

// Bridge API helper
async function sendToBridge(content, channel = 'guild') {
  try {
    const response = await axios.post(
      `${BRIDGE_API}/api/chat/send`,
      { content, channel },
      {
        headers: {
          'Authorization': `Bearer ${BRIDGE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Bridge API Error:', error.response?.data || error.message);
    throw error;
  }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Only process messages in the guild chat channel
  if (message.channel.id !== GUILD_CHANNEL) return;
  
  try {
    // Check for commands
    if (message.content.startsWith('!gc ')) {
      const content = message.content.slice(4);
      await sendToBridge(content, 'guild');
      await message.react('✅');
    }
    else if (message.content.startsWith('!oc ')) {
      const content = message.content.slice(4);
      await sendToBridge(content, 'officer');
      await message.react('✅');
    }
    else if (message.content === '!status') {
      const response = await axios.get(`${BRIDGE_API}/api/bot/status`, {
        headers: { 'Authorization': `Bearer ${BRIDGE_TOKEN}` }
      });
      
      const status = response.data;
      const embed = {
        title: '🌉 Bridge Bot Status',
        fields: [
          {
            name: 'Minecraft',
            value: status.minecraft.connected ? '✅ Connected' : '❌ Disconnected',
            inline: true
          },
          {
            name: 'Discord',
            value: status.discord.connected ? '✅ Connected' : '❌ Disconnected',
            inline: true
          },
          {
            name: 'Uptime',
            value: formatUptime(status.uptime),
            inline: true
          },
          {
            name: 'Extensions',
            value: `${status.extensions.enabled}/${status.extensions.total} enabled`,
            inline: true
          }
        ],
        color: 0x00ff00,
        timestamp: new Date()
      };
      
      await message.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await message.react('❌');
  }
});

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

client.login(process.env.DISCORD_TOKEN);
```

**Step 4: Run the bot**

```bash
node index.js
```

**Usage:**
- `!gc Hello everyone!` - Send message to guild chat
- `!oc Officer message` - Send message to officer chat
- `!status` - Check bridge bot status

---

### Tutorial 3: Build a Next.js Admin Dashboard

**Goal:** Create a full-featured admin dashboard with authentication.

**Step 1: Create Next.js app**

```bash
npx create-next-app@latest bridge-admin --typescript --tailwind --app
cd bridge-admin
npm install socket.io-client @tanstack/react-query axios
```

**Step 2: Create API client**

```typescript
// lib/api.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bridge_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = async (username: string, password: string) => {
  const response = await api.post('/auth/login', { username, password });
  localStorage.setItem('bridge_token', response.data.token);
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('bridge_token');
};

// Chat
export const getMessages = async (limit = 100, offset = 0) => {
  const response = await api.get('/chat/messages', { params: { limit, offset } });
  return response.data;
};

export const sendMessage = async (content: string, channel: 'guild' | 'officer' = 'guild') => {
  const response = await api.post('/chat/send', { content, channel });
  return response.data;
};

// Bot Status
export const getBotStatus = async () => {
  const response = await api.get('/bot/status');
  return response.data;
};

// Extensions
export const getExtensions = async () => {
  const response = await api.get('/extensions');
  return response.data;
};

export const toggleExtension = async (id: string, action: 'enable' | 'disable') => {
  const response = await api.post(`/extensions/${id}/action`, { action });
  return response.data;
};
```

**Step 3: Create WebSocket hook**

```typescript
// hooks/useWebSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('bridge_token');
    if (!token) return;

    const newSocket = io(WS_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('authenticate', { token });
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('chat_message', (message) => {
      setMessages((prev) => [...prev, message].slice(-100));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return { socket, connected, messages };
}
```

**Step 4: Create dashboard page**

```typescript
// app/dashboard/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { getBotStatus, getExtensions } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function Dashboard() {
  const { data: status } = useQuery({
    queryKey: ['bot-status'],
    queryFn: getBotStatus,
    refetchInterval: 5000,
  });

  const { data: extensions } = useQuery({
    queryKey: ['extensions'],
    queryFn: getExtensions,
  });

  const { connected, messages } = useWebSocket();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Bridge Admin Dashboard</h1>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <h3 className="font-semibold mb-2">Minecraft</h3>
          <p className={status?.minecraft.connected ? 'text-green-500' : 'text-red-500'}>
            {status?.minecraft.connected ? '✅ Connected' : '❌ Disconnected'}
          </p>
          <p className="text-sm text-gray-400">{status?.minecraft.username}</p>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Discord</h3>
          <p className={status?.discord.connected ? 'text-green-500' : 'text-red-500'}>
            {status?.discord.connected ? '✅ Connected' : '❌ Disconnected'}
          </p>
          <p className="text-sm text-gray-400">{status?.discord.username}</p>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">WebSocket</h3>
          <p className={connected ? 'text-green-500' : 'text-red-500'}>
            {connected ? '✅ Connected' : '❌ Disconnected'}
          </p>
        </Card>
      </div>

      {/* Extensions */}
      <Card className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Extensions</h2>
        <div className="space-y-2">
          {extensions?.extensions.map((ext: any) => (
            <div key={ext.id} className="flex items-center justify-between p-3 bg-gray-800 rounded">
              <div>
                <h3 className="font-semibold">{ext.name}</h3>
                <p className="text-sm text-gray-400">{ext.description}</p>
              </div>
              <span className={ext.enabled ? 'text-green-500' : 'text-gray-500'}>
                {ext.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Live Chat */}
      <Card>
        <h2 className="text-2xl font-bold mb-4">Live Chat</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx} className="p-2 bg-gray-800 rounded">
              <span className="font-semibold">{msg.username}:</span> {msg.content}
              <span className="text-xs text-gray-400 ml-2">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Card({ children, className = '' }: any) {
  return (
    <div className={`bg-gray-900 p-6 rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
}
```

---

## Client Libraries

### JavaScript/TypeScript

```typescript
// bridge-client.ts
import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';

export class BridgeClient {
  private api: AxiosInstance;
  private socket: Socket | null = null;
  private token: string | null = null;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.api = axios.create({ baseURL: `${baseURL}/api` });
    
    // Add token to requests
    this.api.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  async login(username: string, password: string) {
    const response = await this.api.post('/auth/login', { username, password });
    this.token = response.data.token;
    return response.data;
  }

  async sendMessage(content: string, channel: 'guild' | 'officer' = 'guild') {
    return (await this.api.post('/chat/send', { content, channel })).data;
  }

  async getMessages(limit = 100, offset = 0) {
    return (await this.api.get('/chat/messages', { params: { limit, offset } })).data;
  }

  async getBotStatus() {
    return (await this.api.get('/bot/status')).data;
  }

  async getExtensions() {
    return (await this.api.get('/extensions')).data;
  }

  async toggleExtension(id: string, action: 'enable' | 'disable' | 'reload') {
    return (await this.api.post(`/extensions/${id}/action`, { action })).data;
  }

  connectWebSocket(onMessage: (message: any) => void) {
    if (!this.token) throw new Error('Must login first');
    
    this.socket = io(this.api.defaults.baseURL!.replace('/api', ''));
    
    this.socket.on('connect', () => {
      this.socket!.emit('authenticate', { token: this.token });
    });

    this.socket.on('chat_message', onMessage);
    
    return this.socket;
  }

  disconnectWebSocket() {
    this.socket?.close();
  }
}

// Usage
const client = new BridgeClient('http://localhost:3000');
await client.login('admin', 'password');
await client.sendMessage('Hello!');

client.connectWebSocket((message) => {
  console.log('New message:', message);
});
```

### Python

```python
# bridge_client.py
import requests
import socketio
from typing import Optional, Dict, Any

class BridgeClient:
    def __init__(self, base_url: str = 'http://localhost:3000'):
        self.base_url = base_url
        self.api_url = f'{base_url}/api'
        self.token: Optional[str] = None
        self.sio: Optional[socketio.Client] = None
    
    def _headers(self) -> Dict[str, str]:
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
    
    def login(self, username: str, password: str) -> Dict[str, Any]:
        response = requests.post(
            f'{self.api_url}/auth/login',
            json={'username': username, 'password': password}
        )
        response.raise_for_status()
        data = response.json()
        self.token = data['token']
        return data
    
    def send_message(self, content: str, channel: str = 'guild') -> Dict[str, Any]:
        response = requests.post(
            f'{self.api_url}/chat/send',
            json={'content': content, 'channel': channel},
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()
    
    def get_messages(self, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        response = requests.get(
            f'{self.api_url}/chat/messages',
            params={'limit': limit, 'offset': offset},
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()
    
    def get_bot_status(self) -> Dict[str, Any]:
        response = requests.get(
            f'{self.api_url}/bot/status',
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()
    
    def connect_websocket(self, on_message_callback):
        if not self.token:
            raise Exception('Must login first')
        
        self.sio = socketio.Client()
        
        @self.sio.on('connect')
        def on_connect():
            self.sio.emit('authenticate', {'token': self.token})
        
        @self.sio.on('chat_message')
        def on_message(message):
            on_message_callback(message)
        
        self.sio.connect(self.base_url)
    
    def disconnect_websocket(self):
        if self.sio:
            self.sio.disconnect()

# Usage
client = BridgeClient('http://localhost:3000')
client.login('admin', 'password')
client.send_message('Hello from Python!')

def handle_message(message):
    print(f"[{message['source']}] {message['username']}: {message['content']}")

client.connect_websocket(handle_message)
```

---

## Common Use Cases

### Use Case 1: Multi-Server Chat Bridge

Connect multiple Minecraft servers or Discord servers through the Bridge API.

```javascript
// multi-server-bridge.js
const BridgeClient = require('./bridge-client');

const bridge1 = new BridgeClient('http://server1:3000');
const bridge2 = new BridgeClient('http://server2:3000');

await bridge1.login('admin', 'password1');
await bridge2.login('admin', 'password2');

// Forward messages from bridge1 to bridge2
bridge1.connectWebSocket(async (message) => {
  await bridge2.sendMessage(`[Server1] ${message.username}: ${message.content}`);
});

// Forward messages from bridge2 to bridge1
bridge2.connectWebSocket(async (message) => {
  await bridge1.sendMessage(`[Server2] ${message.username}: ${message.content}`);
});
```

### Use Case 2: Chat Logger

Store all chat messages in a database for later analysis.

```javascript
// chat-logger.js
const { Pool } = require('pg');
const BridgeClient = require('./bridge-client');

const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

const bridge = new BridgeClient();
await bridge.login('admin', 'password');

bridge.connectWebSocket(async (message) => {
  await db.query(
    'INSERT INTO chat_messages (source, username, content, timestamp) VALUES ($1, $2, $3, $4)',
    [message.source, message.username, message.content, message.timestamp]
  );
  
  console.log('Logged message from', message.username);
});
```

### Use Case 3: Custom Command System

Create custom commands that execute through the Bridge API.

```javascript
// custom-commands.js
const bridge = new BridgeClient();
await bridge.login('admin', 'password');

const commands = {
  '!online': async () => {
    const status = await bridge.getBotStatus();
    return `Online players: ${status.onlineCount}`;
  },
  
  '!extensions': async () => {
    const exts = await bridge.getExtensions();
    return `Extensions: ${exts.enabled}/${exts.total} enabled`;
  },
  
  '!uptime': async () => {
    const { formatted } = await bridge.api.get('/bot/uptime');
    return `Uptime: ${formatted}`;
  }
};

bridge.connectWebSocket(async (message) => {
  if (message.content.startsWith('!')) {
    const handler = commands[message.content.split(' ')[0]];
    if (handler) {
      const response = await handler();
      await bridge.sendMessage(response);
    }
  }
});
```

---

## Best Practices

### 1. **Token Management**

```typescript
// ✅ Good: Store tokens securely
// Browser
localStorage.setItem('bridge_token', token);

// Node.js
process.env.BRIDGE_TOKEN = token;

// ❌ Bad: Hardcode tokens in source code
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Don't do this!
```

### 2. **Error Handling**

```typescript
// ✅ Good: Handle errors gracefully
try {
  await bridge.sendMessage(content);
} catch (error) {
  if (error.response?.status === 429) {
    console.log('Rate limited, waiting...');
    await sleep(60000);
  } else if (error.response?.status === 401) {
    console.log('Token expired, re-authenticating...');
    await bridge.login(username, password);
  } else {
    console.error('Unexpected error:', error);
  }
}

// ❌ Bad: Ignore errors
await bridge.sendMessage(content); // No error handling
```

### 3. **Rate Limiting Respect**

```typescript
// ✅ Good: Implement backoff
class RateLimitedClient {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  
  async enqueue(fn: () => Promise<any>) {
    this.queue.push(fn);
    if (!this.processing) {
      await this.processQueue();
    }
  }
  
  private async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      try {
        await fn();
        await sleep(100); // Rate limit ourselves
      } catch (error) {
        if (error.response?.status === 429) {
          await sleep(60000); // Wait 1 minute if rate limited
        }
      }
    }
    this.processing = false;
  }
}
```

### 4. **WebSocket Reconnection**

```typescript
// ✅ Good: Handle reconnections
function connectWithReconnect(client: BridgeClient) {
  let reconnectAttempts = 0;
  const maxAttempts = 5;
  
  function connect() {
    const socket = client.connectWebSocket((message) => {
      // Handle message
    });
    
    socket.on('disconnect', () => {
      if (reconnectAttempts < maxAttempts) {
        reconnectAttempts++;
        console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
        setTimeout(connect, 5000 * reconnectAttempts);
      }
    });
    
    socket.on('connect', () => {
      reconnectAttempts = 0; // Reset on successful connection
    });
  }
  
  connect();
}
```

### 5. **Environment Configuration**

```typescript
// ✅ Good: Use environment variables
const config = {
  apiUrl: process.env.BRIDGE_API_URL || 'http://localhost:3000',
  username: process.env.BRIDGE_USERNAME,
  password: process.env.BRIDGE_PASSWORD,
  enableAuth: process.env.BRIDGE_ENABLE_AUTH !== 'false',
};

// ❌ Bad: Hardcode configuration
const config = {
  apiUrl: 'http://production-server.com:3000',
  username: 'admin',
  password: 'password123',
};
```

---

## Troubleshooting

### Common Issues

**1. CORS Errors in Browser**

```javascript
// Solution: Configure ALLOWED_ORIGINS in Bridge Bot
// .env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://yourdomain.com
```

**2. Authentication Failures**

```javascript
// Check if token is expired
const decoded = jwt.decode(token);
if (decoded.exp < Date.now() / 1000) {
  console.log('Token expired, need to re-login');
}
```

**3. WebSocket Not Connecting**

```javascript
// Enable debug logging
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  debug: true,
});
```

---

## Support & Resources

- **API Documentation:** See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **GitHub Repository:** https://github.com/MiscGuild/guild-bridge-bot
- **Issues:** https://github.com/MiscGuild/guild-bridge-bot/issues

---

**Happy integrating! 🌉**
