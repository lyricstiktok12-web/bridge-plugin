# Bridge Bot API Integration

This document explains the Bridge Adapter system that exposes the bot functionality through REST API and WebSocket interfaces.

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Features](#features)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Event System](#event-system)
- [Documentation](#documentation)

---

## Overview

The Bridge Adapter is a comprehensive API layer that sits on top of the existing Bridge bot, providing:

- **REST API** - HTTP endpoints for programmatic access to bot functionality
- **WebSocket Server** - Real-time event streaming for chat messages and status updates
- **Authentication** - JWT-based authentication system (optional)
- **Rate Limiting** - Protection against API abuse
- **Event Broadcasting** - Emit custom events from the bot to connected clients

The adapter is **optional** and does not interfere with the bot's core functionality. When disabled, the bot operates normally without any API access.

---

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Update your `.env` file (or create one from `.env.example`):

```env
# Enable the API
ENABLE_API=true
API_PORT=3000

# Authentication (optional but recommended)
ENABLE_AUTH=true
JWT_SECRET=your-secure-random-secret-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 3. Start the Bot

```bash
pnpm dev
```

The API will be available at `http://localhost:3000/api`

### 4. Test the API

```bash
# Check health
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Use the returned token for authenticated requests
curl http://localhost:3000/api/bot/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              External Applications                      │
│  (Web Dashboards, Bots, Analytics, etc.)                │
└───────────────┬─────────────────────────────────────────┘
                │ HTTP + WebSocket
                ↓
┌─────────────────────────────────────────────────────────┐
│            Bridge Adapter (NEW)                         │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │   Express API    │    │   Socket.io      │          │
│  │   REST Endpoints │    │   WebSocket      │          │
│  └──────────────────┘    └──────────────────┘          │
│                                                          │
│  - Authentication & Authorization                        │
│  - Rate Limiting                                         │
│  - Request Validation                                    │
│  - Event Broadcasting                                    │
└───────────────┬─────────────────────────────────────────┘
                │ Event Emitter
                ↓
┌─────────────────────────────────────────────────────────┐
│              Bridge Core (EXISTING)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Discord    │  │  Mineflayer  │  │  Extensions  │  │
│  │     Bot      │  │  (Minecraft) │  │   Manager    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Key Design Principles:**

1. **Non-invasive** - The adapter wraps the existing Bridge without modifying core functionality
2. **Optional** - Can be disabled via environment variable
3. **Event-Driven** - Uses Node.js EventEmitter for loose coupling
4. **Extensible** - Easy to add new endpoints and events
5. **Secure** - Built-in authentication and rate limiting

---

## Features

### REST API Endpoints

#### Authentication
- `POST /api/auth/login` - Get JWT token
- `GET /api/auth/me` - Get current user info

#### Chat
- `GET /api/chat/messages` - Retrieve message history (paginated)
- `POST /api/chat/send` - Send message to guild/officer chat
- `GET /api/chat/users` - Get online users

#### Bot Status
- `GET /api/bot/status` - Get comprehensive bot status
- `GET /api/bot/uptime` - Get bot uptime
- `GET /api/health` - Health check endpoint

#### Extensions (Admin)
- `GET /api/extensions` - List all extensions
- `GET /api/extensions/:id` - Get extension details
- `POST /api/extensions/:id/action` - Enable/disable/reload extension
- `GET /api/extensions/:id/config` - Get extension config
- `PUT /api/extensions/:id/config` - Update extension config

#### Commands (Admin)
- `POST /api/command/execute` - Execute Minecraft command

#### Analytics
- `GET /api/analytics/guild-stats` - Guild statistics
- `GET /api/analytics/message-stats` - Message statistics

### WebSocket Events

#### Server → Client
- `chat_message` - New chat message received
- `user_join` - User joined server
- `user_leave` - User left server
- `status_update` - Bot status changed
- `extension_update` - Extension enabled/disabled
- `bot_status` - Initial bot status (on connect)
- `online_users` - Online user count (on connect)

#### Client → Server
- `authenticate` - Authenticate WebSocket connection

---

## Configuration

All configuration is done via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_API` | No | `false` | Enable the API adapter |
| `API_PORT` | No | `3000` | Port for API server |
| `ENABLE_AUTH` | No | `false` | Enable JWT authentication |
| `JWT_SECRET` | If auth enabled | - | Secret for JWT signing |
| `ADMIN_USERNAME` | If auth enabled | - | Admin username |
| `ADMIN_PASSWORD` | If auth enabled | - | Admin password |
| `API_KEY` | No | - | Alternative API key authentication |
| `ALLOWED_ORIGINS` | No | `[]` | Comma-separated CORS origins |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |

### Security Recommendations

**Development:**
```env
ENABLE_API=true
ENABLE_AUTH=false  # Disable for easier testing
API_PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Production:**
```env
ENABLE_API=true
ENABLE_AUTH=true  # Always enable in production!
JWT_SECRET=<generate-secure-random-secret>
ADMIN_PASSWORD=<strong-password>
API_PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com
RATE_LIMIT_MAX_REQUESTS=50  # Stricter rate limit
```

---

## Usage Examples

### Example 1: Send a Message

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const token = 'your-jwt-token';

async function sendMessage(content) {
  const response = await axios.post(
    `${API_URL}/chat/send`,
    { content, channel: 'guild' },
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  console.log('Message sent:', response.data);
}

sendMessage('Hello from external app!');
```

### Example 2: Monitor Chat in Real-Time

```javascript
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('authenticate', { token: 'your-jwt-token' });
});

socket.on('chat_message', (message) => {
  console.log(`[${message.source}] ${message.username}: ${message.content}`);
});

socket.on('user_join', ({ username }) => {
  console.log(`${username} joined the game`);
});
```

### Example 3: Manage Extensions

```javascript
async function toggleExtension(extensionId, action) {
  const response = await axios.post(
    `${API_URL}/extensions/${extensionId}/action`,
    { action }, // 'enable', 'disable', or 'reload'
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  console.log(`Extension ${action}d:`, response.data);
}

await toggleExtension('fun-bot', 'disable');
```

### Example 4: Get Bot Statistics

```javascript
async function printStats() {
  const status = await axios.get(`${API_URL}/bot/status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('Bot Status:', {
    minecraft: status.data.minecraft.connected ? 'Connected' : 'Disconnected',
    discord: status.data.discord.connected ? 'Connected' : 'Disconnected',
    uptime: status.data.uptime,
    extensions: `${status.data.extensions.enabled}/${status.data.extensions.total}`,
  });
}
```

---

## Event System

The Bridge Adapter uses Node.js EventEmitter to communicate with the core Bridge bot. This allows you to emit custom events from anywhere in your bot code.

### Emitting Events from Bot Code

```typescript
// In any part of your bot code (e.g., in an extension or event handler)
import bridge from '../bridge';

// Emit a chat message event
bridge.emit('chat:message', {
  id: 'unique-id',
  source: 'minecraft',
  username: 'Player123',
  content: 'Hello!',
  timestamp: new Date(),
  metadata: { rank: 'VIP' }
});

// Emit a user join event
bridge.emit('user:join', { username: 'Player123' });

// Emit a custom event
bridge.emit('status:update', { minecraft: { connected: true } });
```

### Using the Adapter API

```typescript
// From src/index.ts, you can access the adapter
import { bridge, adapter } from './index';

// Manually emit a chat message
adapter?.emitChatMessage({
  id: 'msg-123',
  source: 'minecraft',
  username: 'System',
  content: 'Server maintenance in 5 minutes',
  timestamp: new Date()
});

// Broadcast a custom event to all WebSocket clients
adapter?.broadcast('custom_event', {
  type: 'announcement',
  message: 'Important update!'
});
```

### Listening for Events in Extensions

```typescript
// In your extension
export default class MyExtension implements MineflayerExtension {
  async onEnable(context: ExtensionLoadContext): Promise<void> {
    // Access the bridge through context
    const { bridge } = context;
    
    // Listen for API events
    bridge.on('chat:message', (message) => {
      console.log('Message received:', message);
    });
  }
}
```

---

## Documentation

### Complete API Reference

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for:
- Complete endpoint documentation
- Request/response examples
- Data type definitions
- Authentication guide
- Error handling
- Rate limiting details

### Integration Guide

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for:
- Step-by-step tutorials
- Example client applications
- Client libraries (JavaScript, Python)
- Common use cases
- Best practices
- Troubleshooting

### Architecture Diagram

```
External App (React/Vue/etc.)
         ↓
  [HTTP GET /api/chat/messages]
         ↓
  Bridge Adapter → validateToken()
         ↓
  Bridge Adapter → bridge.messageHistory
         ↓
  [Return JSON Response]


External App (WebSocket Client)
         ↓
  [Connect to Socket.io]
         ↓
  [Emit 'authenticate' event]
         ↓
  Bridge Adapter → verifyJWT()
         ↓
  Bridge Core → emit('chat:message')
         ↓
  Bridge Adapter → io.emit('chat_message')
         ↓
  [External App receives event]
```

---

## Development

### Adding New Endpoints

1. Define route in `src/server/bridge-adapter.ts`:

```typescript
private setupRoutes(): void {
  // ... existing routes
  
  this.app.get('/api/custom/endpoint', 
    this.authenticateToken, 
    this.handleCustomEndpoint.bind(this)
  );
}

private handleCustomEndpoint(req: Request, res: Response): void {
  // Your logic here
  res.json({ message: 'Custom endpoint response' });
}
```

2. Update documentation in `API_DOCUMENTATION.md`

### Adding New WebSocket Events

1. Emit from Bridge core:

```typescript
// In your bot code
bridge.emit('my:custom:event', { data: 'value' });
```

2. Set up listener in adapter:

```typescript
private setupBridgeListeners(): void {
  // ... existing listeners
  
  this.bridge.on('my:custom:event', (data) => {
    this.io.emit('custom_event', data);
  });
}
```

3. Update documentation

### Testing

```bash
# Run tests (when implemented)
pnpm test

# Test API health
curl http://localhost:3000/api/health

# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Test WebSocket connection
npm install -g wscat
wscat -c ws://localhost:3000
```

---

## Troubleshooting

### Issue: API Not Starting

**Symptoms:** Bot starts but API endpoints don't respond

**Solutions:**
1. Check `ENABLE_API=true` in `.env`
2. Check if port is already in use: `lsof -i :3000` (Mac/Linux) or `netstat -ano | findstr :3000` (Windows)
3. Check console for error messages

### Issue: Authentication Failing

**Symptoms:** 401 or 403 errors

**Solutions:**
1. Verify JWT_SECRET matches between server and client
2. Check token hasn't expired
3. Ensure `Authorization: Bearer <token>` header is set correctly
4. For testing, set `ENABLE_AUTH=false`

### Issue: CORS Errors

**Symptoms:** Browser console shows CORS errors

**Solutions:**
1. Add your origin to `ALLOWED_ORIGINS` in `.env`
2. Restart the bot after changing `.env`
3. Check browser is sending correct `Origin` header

### Issue: WebSocket Not Connecting

**Symptoms:** WebSocket connection fails or immediately disconnects

**Solutions:**
1. Check API is running
2. Verify WebSocket URL (should be base URL without `/api`)
3. Check firewall/proxy settings
4. Enable debug logging: `io('http://localhost:3000', { debug: true })`

---

## Migration from Existing Bot

The adapter is **fully backward compatible**. Your existing bot will continue to work without any changes.

**To enable the API:**

1. Add new environment variables to `.env`
2. Run `pnpm install` to get new dependencies
3. Start the bot as usual

**No code changes required!** The adapter automatically integrates when `ENABLE_API=true`.

---

## License

Same as the main Bridge Bot project (MIT).

---

## Support

- **Issues:** [GitHub Issues](https://github.com/MiscGuild/guild-bridge-bot/issues)
- **Discussions:** [GitHub Discussions](https://github.com/MiscGuild/guild-bridge-bot/discussions)
- **Documentation:** [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) & [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)

---

**Happy coding! 🚀**
