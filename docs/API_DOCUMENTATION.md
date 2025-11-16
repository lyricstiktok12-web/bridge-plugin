# Bridge Bot API Documentation

## Table of Contents
- [Overview](#overview)
- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [REST API Endpoints](#rest-api-endpoints)
- [WebSocket Events](#websocket-events)
- [Data Types](#data-types)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Overview

The Bridge Bot API provides comprehensive access to bot functionality through both REST API endpoints and WebSocket connections. This allows external applications to:

- **Monitor** real-time chat messages between Discord and Minecraft
- **Send** messages to Minecraft guild chat or officer chat
- **Manage** bot extensions (enable, disable, configure)
- **Access** bot status, statistics, and analytics
- **Execute** administrative commands
- **Track** online users and guild activity

### Base URL
```
http://localhost:3000/api
```

### WebSocket URL
```
ws://localhost:3000
```

---

## Getting Started

### Installation & Setup

1. **Install Dependencies**
```bash
pnpm install
```

2. **Configure Environment Variables**

Create or update your `.env` file:

```env
# API Configuration
API_PORT=3000
ENABLE_AUTH=true
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Authentication (if ENABLE_AUTH=true)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
API_KEY=your-api-key-here

# Existing bot configuration
DISCORD_TOKEN=your_discord_token
MINECRAFT_EMAIL=your_email
MINECRAFT_PASSWORD=your_password
HYPIXEL_API_KEY=your_api_key
```

3. **Start the Bot with API**

Update `src/index.ts`:

```typescript
import Bridge from './bridge';
import BridgeAdapter from './server/bridge-adapter';

const bridge = new Bridge();
const adapter = new BridgeAdapter(bridge);

adapter.start();

export { bridge, adapter };
```

4. **Run the Bot**
```bash
pnpm dev
```

The API will be available at `http://localhost:3000`

---

## Authentication

The API supports JWT (JSON Web Token) authentication. Authentication can be enabled or disabled via the `ENABLE_AUTH` environment variable.

### Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Or use API Key:**
```json
{
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800,
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

### Using the Token

Include the token in the `Authorization` header for all subsequent requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Get Current User

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "user": {
    "id": "admin",
    "role": "admin",
    "username": "admin"
  }
}
```

---

## REST API Endpoints

### Health Check

#### `GET /api/health`

Check if the API and bot are running.

**Authentication:** None required

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-16T10:30:00.000Z",
  "uptime": 3600,
  "minecraft": {
    "connected": true
  },
  "discord": {
    "connected": true
  }
}
```

---

### Chat Endpoints

#### `GET /api/chat/messages`

Retrieve chat message history.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional, default: 100) - Number of messages to return
- `offset` (optional, default: 0) - Offset for pagination

**Example Request:**
```
GET /api/chat/messages?limit=50&offset=0
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_1234567890",
      "source": "minecraft",
      "username": "Player123",
      "content": "Hello everyone!",
      "timestamp": "2025-11-16T10:30:00.000Z",
      "metadata": {
        "rank": "VIP",
        "guildRank": "Member",
        "channel": "guild"
      }
    }
  ],
  "total": 1523,
  "limit": 50,
  "offset": 0
}
```

#### `POST /api/chat/send`

Send a message to Minecraft guild chat or officer chat.

**Authentication:** Required

**Request Body:**
```json
{
  "content": "Hello from the API!",
  "channel": "guild"
}
```

**Fields:**
- `content` (required, string, 1-256 chars) - Message content
- `channel` (optional, "guild" | "officer", default: "guild") - Target channel

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "content": "Hello from the API!",
    "channel": "guild",
    "timestamp": "2025-11-16T10:30:00.000Z"
  }
}
```

**Error Response:**
```json
{
  "error": "Invalid request data",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "message": "String must contain at least 1 character(s)",
      "path": ["content"]
    }
  ]
}
```

#### `GET /api/chat/users`

Get information about online users.

**Authentication:** Required

**Response:**
```json
{
  "onlineCount": 42,
  "totalCount": 125,
  "users": []
}
```

---

### Bot Status Endpoints

#### `GET /api/bot/status`

Get comprehensive bot status information.

**Authentication:** Required

**Response:**
```json
{
  "online": true,
  "minecraft": {
    "connected": true,
    "username": "BridgeBot",
    "server": "mc.hypixel.net"
  },
  "discord": {
    "connected": true,
    "username": "Bridge Bot",
    "guilds": 1
  },
  "uptime": 86400,
  "extensions": {
    "total": 7,
    "enabled": 6,
    "disabled": 1,
    "chatPatterns": 24
  }
}
```

#### `GET /api/bot/uptime`

Get bot uptime information.

**Authentication:** Required

**Response:**
```json
{
  "uptimeSeconds": 86400,
  "formatted": "1d 0h 0m 0s",
  "startTime": "2025-11-15T10:30:00.000Z"
}
```

---

### Extension Management Endpoints

#### `GET /api/extensions`

List all extensions with their status.

**Authentication:** Required

**Response:**
```json
{
  "total": 7,
  "enabled": 6,
  "disabled": 1,
  "extensions": [
    {
      "id": "duplicate-message-handler",
      "name": "Duplicate Message Handler",
      "version": "1.0.0",
      "description": "Prevents duplicate messages",
      "enabled": true,
      "author": "BridgeTeam",
      "stats": {
        "chatPatterns": 2,
        "commandsRegistered": 0
      }
    },
    {
      "id": "fun-bot",
      "name": "Fun Bot",
      "version": "1.0.0",
      "description": "Auto-responds to specific patterns",
      "enabled": true,
      "author": "BridgeTeam",
      "stats": {
        "chatPatterns": 15,
        "commandsRegistered": 0
      }
    }
  ]
}
```

#### `GET /api/extensions/:id`

Get detailed information about a specific extension.

**Authentication:** Required

**URL Parameters:**
- `id` - Extension ID (e.g., "fun-bot")

**Response:**
```json
{
  "id": "fun-bot",
  "name": "Fun Bot",
  "version": "1.0.0",
  "description": "Auto-responds to specific patterns",
  "enabled": true,
  "author": "BridgeTeam",
  "stats": {
    "chatPatterns": 15,
    "commandsRegistered": 0
  }
}
```

**Error Response:**
```json
{
  "error": "Extension not found"
}
```

#### `POST /api/extensions/:id/action`

Perform an action on an extension (enable, disable, reload).

**Authentication:** Required (Admin only)

**URL Parameters:**
- `id` - Extension ID

**Request Body:**
```json
{
  "action": "enable"
}
```

**Actions:**
- `enable` - Enable the extension
- `disable` - Disable the extension
- `reload` - Reload the extension (disable then enable)

**Response:**
```json
{
  "success": true,
  "message": "Extension enabled successfully",
  "extension": {
    "id": "fun-bot",
    "name": "Fun Bot",
    "enabled": true
  }
}
```

#### `GET /api/extensions/:id/config`

Get extension configuration.

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "id": "fun-bot",
  "config": {
    "enabled": true,
    "patterns": [
      {
        "trigger": "hello",
        "response": "Hi there!"
      }
    ]
  }
}
```

#### `PUT /api/extensions/:id/config`

Update extension configuration.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "config": {
    "enabled": true,
    "patterns": [
      {
        "trigger": "hello",
        "response": "Hi there!"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Extension config updated successfully",
  "config": {
    "enabled": true,
    "patterns": [...]
  }
}
```

---

### Command Execution

#### `POST /api/command/execute`

Execute a Minecraft command through the bot.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "command": "/g online"
}
```

**Response:**
```json
{
  "success": true,
  "command": "/g online",
  "result": "Online Members: Player1, Player2, Player3..."
}
```

**Error Response:**
```json
{
  "error": "Command execution failed",
  "message": "Bot is not connected to Minecraft"
}
```

---

### Analytics Endpoints

#### `GET /api/analytics/guild-stats`

Get guild statistics (reads from `data/guild-analytics.json`).

**Authentication:** Required

**Response:**
```json
{
  "guildName": "Example Guild",
  "members": 125,
  "guildLevel": 50,
  "experience": 1234567,
  "lastUpdated": "2025-11-16T10:00:00.000Z"
}
```

#### `GET /api/analytics/message-stats`

Get message statistics.

**Authentication:** Required

**Response:**
```json
{
  "total": 15234,
  "last24Hours": 542,
  "bySource": {
    "minecraft": 8234,
    "discord": 7000
  },
  "averagePerHour": 23
}
```

---

## WebSocket Events

The WebSocket connection provides real-time updates for chat messages, user activity, and bot status changes.

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});
```

### Authentication

After connecting, authenticate with your JWT token:

```javascript
socket.emit('authenticate', {
  token: 'your-jwt-token'
});

socket.on('authenticated', (data) => {
  if (data.success) {
    console.log('Authenticated successfully');
  } else {
    console.error('Authentication failed:', data.error);
  }
});
```

### Events from Server

#### `chat_message`

Emitted when a new chat message is received.

**Data:**
```json
{
  "id": "msg_1234567890",
  "source": "minecraft",
  "username": "Player123",
  "content": "Hello everyone!",
  "timestamp": "2025-11-16T10:30:00.000Z",
  "metadata": {
    "rank": "VIP",
    "guildRank": "Member",
    "channel": "guild"
  }
}
```

**Example:**
```javascript
socket.on('chat_message', (message) => {
  console.log(`[${message.source}] ${message.username}: ${message.content}`);
});
```

#### `user_join`

Emitted when a user joins the Minecraft server.

**Data:**
```json
{
  "username": "Player123"
}
```

#### `user_leave`

Emitted when a user leaves the Minecraft server.

**Data:**
```json
{
  "username": "Player123"
}
```

#### `status_update`

Emitted when bot status changes.

**Data:**
```json
{
  "minecraft": {
    "connected": true
  },
  "discord": {
    "connected": true
  }
}
```

#### `extension_update`

Emitted when an extension is enabled, disabled, or reloaded.

**Data:**
```json
{
  "id": "fun-bot",
  "name": "Fun Bot",
  "action": "enabled"
}
```

#### `bot_status`

Sent once upon connection with full bot status.

**Data:**
```json
{
  "online": true,
  "minecraft": {
    "connected": true,
    "username": "BridgeBot",
    "server": "mc.hypixel.net"
  },
  "discord": {
    "connected": true,
    "username": "Bridge Bot",
    "guilds": 1
  },
  "uptime": 86400,
  "extensions": {
    "total": 7,
    "enabled": 6,
    "disabled": 1
  }
}
```

#### `online_users`

Sent once upon connection with online user count.

**Data:**
```json
{
  "count": 42
}
```

---

## Data Types

### ChatMessage

```typescript
interface ChatMessage {
  id: string;                    // Unique message ID
  source: 'minecraft' | 'discord'; // Message source
  username: string;               // Sender's username
  content: string;                // Message content
  timestamp: Date;                // Message timestamp
  metadata?: {                    // Optional metadata
    rank?: string;                // Player rank (VIP, MVP, etc.)
    guildRank?: string;          // Guild rank (Member, Officer, etc.)
    channel?: 'guild' | 'officer'; // Channel type
    replyTo?: string;            // ID of message being replied to
    [key: string]: any;          // Additional custom fields
  };
}
```

### BotStatus

```typescript
interface BotStatus {
  online: boolean;
  minecraft: {
    connected: boolean;
    username?: string;
    server?: string;
  };
  discord: {
    connected: boolean;
    username?: string;
    guilds?: number;
  };
  uptime: number;                // Uptime in seconds
  extensions: {
    total: number;
    enabled: number;
    disabled: number;
  };
}
```

### ExtensionInfo

```typescript
interface ExtensionInfo {
  id: string;                    // Unique extension ID
  name: string;                  // Display name
  version: string;               // Semantic version
  description: string;           // Description
  enabled: boolean;              // Enable status
  author?: string;               // Author name
  stats?: {
    chatPatterns?: number;       // Number of registered patterns
    commandsRegistered?: number; // Number of commands
    [key: string]: any;          // Additional stats
  };
}
```

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "details": []  // Additional error details (for validation errors)
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

### Common Errors

#### 401 Unauthorized
```json
{
  "error": "Access token required"
}
```

#### 403 Forbidden
```json
{
  "error": "Admin access required"
}
```

#### 400 Bad Request (Validation Error)
```json
{
  "error": "Invalid request data",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "message": "String must contain at least 1 character(s)",
      "path": ["content"]
    }
  ]
}
```

#### 429 Rate Limit
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Window:** 15 minutes (900,000 ms)
- **Max Requests:** 100 per window per IP

When rate limit is exceeded, the API returns a `429` status code.

**Headers:**
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Time when the limit resets (Unix timestamp)

---

## Examples

### Node.js / JavaScript

#### Send a Message

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const token = 'your-jwt-token';

async function sendMessage(content, channel = 'guild') {
  try {
    const response = await axios.post(
      `${API_URL}/chat/send`,
      { content, channel },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

sendMessage('Hello from Node.js!');
```

#### Listen for Chat Messages

```javascript
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to WebSocket');
  
  // Authenticate
  socket.emit('authenticate', { token: 'your-jwt-token' });
});

socket.on('authenticated', (data) => {
  if (data.success) {
    console.log('Authenticated!');
  }
});

socket.on('chat_message', (message) => {
  console.log(`[${message.source}] ${message.username}: ${message.content}`);
});

socket.on('user_join', (data) => {
  console.log(`${data.username} joined the server`);
});

socket.on('user_leave', (data) => {
  console.log(`${data.username} left the server`);
});
```

### Python

```python
import requests
import socketio

API_URL = 'http://localhost:3000/api'
token = 'your-jwt-token'

# REST API Example
def send_message(content, channel='guild'):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'content': content,
        'channel': channel
    }
    
    response = requests.post(
        f'{API_URL}/chat/send',
        json=data,
        headers=headers
    )
    
    return response.json()

# WebSocket Example
sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print('Connected to WebSocket')
    sio.emit('authenticate', {'token': token})

@sio.on('authenticated')
def on_authenticated(data):
    if data['success']:
        print('Authenticated!')

@sio.on('chat_message')
def on_chat_message(message):
    print(f"[{message['source']}] {message['username']}: {message['content']}")

sio.connect('http://localhost:3000')
sio.wait()
```

### cURL

#### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

#### Send Message
```bash
curl -X POST http://localhost:3000/api/chat/send \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from cURL!", "channel": "guild"}'
```

#### Get Bot Status
```bash
curl -X GET http://localhost:3000/api/bot/status \
  -H "Authorization: Bearer your-jwt-token"
```

#### Enable Extension
```bash
curl -X POST http://localhost:3000/api/extensions/fun-bot/action \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"action": "enable"}'
```

---

## Integration with External Applications

### React/Next.js Example

Create a custom hook for the API:

```typescript
// hooks/useBridgeAPI.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const token = typeof window !== 'undefined' ? localStorage.getItem('bridge_token') : null;

export function useBridgeAPI() {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (token) {
        newSocket.emit('authenticate', { token });
      }
    });

    newSocket.on('chat_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = async (content: string, channel = 'guild') => {
    const response = await fetch(`${API_URL}/api/chat/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, channel }),
    });

    return response.json();
  };

  return { messages, sendMessage, socket };
}
```

### Discord Bot Integration

If you're building a separate Discord bot that needs to interact with the Bridge:

```javascript
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const BRIDGE_API = 'http://localhost:3000/api';
const BRIDGE_TOKEN = 'your-jwt-token';

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  // Forward message to Bridge
  if (message.channel.id === 'your-channel-id') {
    try {
      await axios.post(
        `${BRIDGE_API}/chat/send`,
        {
          content: message.content,
          channel: 'guild'
        },
        {
          headers: { 'Authorization': `Bearer ${BRIDGE_TOKEN}` }
        }
      );
    } catch (error) {
      console.error('Failed to forward message:', error);
    }
  }
});

client.login('your-discord-token');
```

---

## Security Best Practices

1. **Always use HTTPS in production** - Never send tokens over unencrypted connections
2. **Keep JWT_SECRET secure** - Use a strong, randomly generated secret
3. **Rotate tokens regularly** - Implement token refresh if needed
4. **Use environment variables** - Never commit secrets to version control
5. **Implement proper CORS** - Only allow trusted origins
6. **Monitor rate limits** - Track API usage to detect abuse
7. **Use strong passwords** - If using username/password auth
8. **Enable authentication in production** - Never run with `ENABLE_AUTH=false` in production

---

## Troubleshooting

### API Not Starting

**Error:** `Port 3000 is already in use`

**Solution:** Change the port in `.env`:
```env
API_PORT=3001
```

### WebSocket Connection Failed

**Error:** `WebSocket connection failed`

**Solutions:**
1. Check if the API is running
2. Verify the WebSocket URL
3. Check firewall settings
4. Ensure CORS is configured correctly

### Authentication Failed

**Error:** `Invalid or expired token`

**Solutions:**
1. Check if the token is correct
2. Verify JWT_SECRET matches between client and server
3. Check if the token has expired (default: 7 days)
4. Re-login to get a new token

### Extension Not Found

**Error:** `Extension not found`

**Solutions:**
1. Verify the extension ID is correct
2. Check if the extension is loaded: `GET /api/extensions`
3. Ensure the extension directory is correct

---

## Support

For issues, questions, or contributions:

- **GitHub Repository:** https://github.com/MiscGuild/guild-bridge-bot
- **Issues:** https://github.com/MiscGuild/guild-bridge-bot/issues

---

**Last Updated:** November 16, 2025  
**API Version:** 2.0.0
