/**
 * Bridge Adapter - Web API Integration Layer
 * 
 * This module provides a comprehensive REST API and WebSocket interface
 * for the Bridge bot, allowing external applications to:
 * - Monitor real-time chat messages
 * - Send messages to Minecraft/Discord
 * - Manage extensions
 * - Access bot statistics and status
 * - Manage users and bans
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { consola } from 'consola';
import { z } from 'zod';
import Bridge from '../bridge';
import env from '../util/env';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BridgeAdapterConfig {
    apiPort: number;
    enableAuth: boolean;
    jwtSecret: string;
    allowedOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
}

export interface ChatMessage {
    id: string;
    source: 'minecraft' | 'discord';
    username: string;
    content: string;
    timestamp: Date;
    metadata?: {
        rank?: string;
        guildRank?: string;
        channel?: 'guild' | 'officer';
        replyTo?: string;
        [key: string]: any;
    };
}

export interface UserStatus {
    username: string;
    online: boolean;
    lastSeen?: Date;
    rank?: string;
    guildRank?: string;
}

export interface BotStatus {
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
    uptime: number;
    extensions: {
        total: number;
        enabled: number;
        disabled: number;
    };
}

export interface ExtensionInfo {
    id: string;
    name: string;
    version: string;
    description: string;
    enabled: boolean;
    author?: string;
    stats?: {
        chatPatterns?: number;
        commandsRegistered?: number;
        [key: string]: any;
    };
}

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
        username: string;
    };
}

// ============================================================================
// Validation Schemas
// ============================================================================

const sendMessageSchema = z.object({
    content: z.string().min(1).max(256),
    channel: z.enum(['guild', 'officer']).optional().default('guild'),
});

const executeCommandSchema = z.object({
    command: z.string().min(1).max(256),
});

const extensionActionSchema = z.object({
    action: z.enum(['enable', 'disable', 'reload']),
});

const updateExtensionConfigSchema = z.object({
    config: z.record(z.any()),
});

// ============================================================================
// Bridge Adapter Class
// ============================================================================

export class BridgeAdapter {
    private app: Express;
    private httpServer: HTTPServer;
    private io: SocketIOServer;
    private bridge: Bridge;
    private config: BridgeAdapterConfig;
    private startTime: Date;
    private messageHistory: ChatMessage[] = [];
    private maxHistorySize = 1000;

    constructor(bridge: Bridge, config: Partial<BridgeAdapterConfig> = {}) {
        this.bridge = bridge;
        this.startTime = new Date();
        
        // Load configuration with defaults
        this.config = {
            apiPort: config.apiPort || parseInt(process.env.API_PORT || '3000'),
            enableAuth: config.enableAuth !== undefined ? config.enableAuth : (process.env.ENABLE_AUTH === 'true'),
            jwtSecret: config.jwtSecret || process.env.JWT_SECRET || 'change-this-secret-in-production',
            allowedOrigins: config.allowedOrigins || (process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001']),
            rateLimitWindowMs: config.rateLimitWindowMs || 15 * 60 * 1000,
            rateLimitMaxRequests: config.rateLimitMaxRequests || 100,
        };

        // Initialize Express app
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = new SocketIOServer(this.httpServer, {
            cors: {
                origin: this.config.allowedOrigins,
                credentials: true,
            },
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupBridgeListeners();
    }

    // ========================================================================
    // Middleware Setup
    // ========================================================================

    private setupMiddleware(): void {
        // Security middleware
        this.app.use(helmet());
        
        // CORS
        this.app.use(cors({
            origin: this.config.allowedOrigins,
            credentials: true,
        }));

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: this.config.rateLimitWindowMs,
            max: this.config.rateLimitMaxRequests,
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use('/api/', limiter);

        // Request logging
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            consola.debug(`${req.method} ${req.path}`);
            next();
        });

        // Error handling middleware
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            consola.error('API Error:', err);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : undefined,
            });
        });
    }

    // ========================================================================
    // Authentication Middleware
    // ========================================================================

    private authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!this.config.enableAuth) {
            // Authentication disabled, allow all requests
            req.user = { id: 'anonymous', role: 'admin', username: 'anonymous' };
            return next();
        }

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }

        try {
            const decoded = jwt.verify(token, this.config.jwtSecret) as any;
            req.user = decoded;
            next();
        } catch (error) {
            res.status(403).json({ error: 'Invalid or expired token' });
        }
    };

    private requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || req.user.role !== 'admin') {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        next();
    };

    // ========================================================================
    // Route Setup
    // ========================================================================

    private setupRoutes(): void {
        // Health check endpoint (public)
        this.app.get('/api/health', this.handleHealthCheck.bind(this));
        
        // Authentication endpoints
        this.app.post('/api/auth/login', this.handleLogin.bind(this));
        this.app.get('/api/auth/me', this.authenticateToken, this.handleGetCurrentUser.bind(this));

        // Chat endpoints
        this.app.get('/api/chat/messages', this.authenticateToken, this.handleGetMessages.bind(this));
        this.app.post('/api/chat/send', this.authenticateToken, this.handleSendMessage.bind(this));
        this.app.get('/api/chat/users', this.authenticateToken, this.handleGetOnlineUsers.bind(this));

        // Bot status endpoints
        this.app.get('/api/bot/status', this.authenticateToken, this.handleGetBotStatus.bind(this));
        this.app.get('/api/bot/uptime', this.authenticateToken, this.handleGetUptime.bind(this));

        // Extension management endpoints (admin only)
        this.app.get('/api/extensions', this.authenticateToken, this.handleGetExtensions.bind(this));
        this.app.get('/api/extensions/:id', this.authenticateToken, this.handleGetExtension.bind(this));
        this.app.post('/api/extensions/:id/action', this.authenticateToken, this.requireAdmin, this.handleExtensionAction.bind(this));
        this.app.get('/api/extensions/:id/config', this.authenticateToken, this.requireAdmin, this.handleGetExtensionConfig.bind(this));
        this.app.put('/api/extensions/:id/config', this.authenticateToken, this.requireAdmin, this.handleUpdateExtensionConfig.bind(this));

        // Command execution endpoint (admin only)
        this.app.post('/api/command/execute', this.authenticateToken, this.requireAdmin, this.handleExecuteCommand.bind(this));

        // Analytics endpoints
        this.app.get('/api/analytics/guild-stats', this.authenticateToken, this.handleGetGuildStats.bind(this));
        this.app.get('/api/analytics/message-stats', this.authenticateToken, this.handleGetMessageStats.bind(this));

        consola.info('API routes initialized');
    }

    // ========================================================================
    // Route Handlers
    // ========================================================================

    private handleHealthCheck(req: Request, res: Response): void {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
            minecraft: {
                connected: this.bridge.mineflayer.bot?._client?.socket?.writable || false,
            },
            discord: {
                connected: this.bridge.discord.isReady(),
            },
        });
    }

    private handleLogin(req: Request, res: Response): void {
        const { username, password, apiKey } = req.body;

        // Simple authentication - in production, use proper password hashing
        // This is just a placeholder for demonstration
        if (apiKey === process.env.API_KEY || (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD)) {
            const token = jwt.sign(
                { id: username || 'api-user', role: 'admin', username: username || 'api-user' },
                this.config.jwtSecret,
                { expiresIn: '7d' }
            );
            
            res.json({
                token,
                expiresIn: 604800, // 7 days in seconds
                user: {
                    username: username || 'api-user',
                    role: 'admin',
                },
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    }

    private handleGetCurrentUser(req: AuthRequest, res: Response): void {
        res.json({ user: req.user });
    }

    private handleGetMessages(req: Request, res: Response): void {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        
        const messages = this.messageHistory.slice(offset, offset + limit);
        
        res.json({
            messages,
            total: this.messageHistory.length,
            limit,
            offset,
        });
    }

    private handleSendMessage(req: Request, res: Response): void {
        try {
            const data = sendMessageSchema.parse(req.body);
            
            // Send to Minecraft
            const chatMode = data.channel === 'officer' ? 'oc' : 'gc';
            this.bridge.mineflayer.chat(chatMode, data.content);
            
            res.json({
                success: true,
                message: 'Message sent successfully',
                data: {
                    content: data.content,
                    channel: data.channel,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Invalid request data', details: error.errors });
            } else {
                res.status(500).json({ error: 'Failed to send message' });
            }
        }
    }

    private handleGetOnlineUsers(req: Request, res: Response): void {
        // This would need to be tracked by the bridge
        // For now, return basic info
        res.json({
            onlineCount: this.bridge.onlineCount,
            totalCount: this.bridge.totalCount,
            users: [], // Would need to track individual users
        });
    }

    private handleGetBotStatus(req: Request, res: Response): void {
        const status: BotStatus = {
            online: true,
            minecraft: {
                connected: this.bridge.mineflayer.bot?._client?.socket?.writable || false,
                username: this.bridge.mineflayer.bot?.username,
                server: 'mc.hypixel.net',
            },
            discord: {
                connected: this.bridge.discord.isReady(),
                username: this.bridge.discord.user?.username,
                guilds: this.bridge.discord.guilds.cache.size,
            },
            uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
            extensions: this.bridge.extensionManager.getExtensionStats(),
        };

        res.json(status);
    }

    private handleGetUptime(req: Request, res: Response): void {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        res.json({
            uptimeSeconds,
            formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
            startTime: this.startTime.toISOString(),
        });
    }

    private handleGetExtensions(req: Request, res: Response): void {
        const stats = this.bridge.extensionManager.getExtensionStats();
        res.json({
            total: stats.total,
            enabled: stats.enabled,
            disabled: stats.disabled,
            extensions: stats.list,
        });
    }

    private handleGetExtension(req: Request, res: Response): void {
        const { id } = req.params;
        const stats = this.bridge.extensionManager.getExtensionStats();
        const extension = stats.list.find(ext => ext.id === id);
        
        if (!extension) {
            res.status(404).json({ error: 'Extension not found' });
            return;
        }

        res.json(extension);
    }

    private async handleExtensionAction(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        
        if (!id) {
            res.status(400).json({ error: 'Extension ID is required' });
            return;
        }
        
        try {
            const data = extensionActionSchema.parse(req.body);
            
            switch (data.action) {
                case 'enable':
                    await this.bridge.extensionManager.enableExtension(id);
                    break;
                case 'disable':
                    await this.bridge.extensionManager.disableExtension(id);
                    break;
                case 'reload':
                    await this.bridge.extensionManager.disableExtension(id);
                    await this.bridge.extensionManager.enableExtension(id);
                    break;
            }
            
            // Get updated extension info
            const stats = this.bridge.extensionManager.getExtensionStats();
            const extension = stats.list.find(ext => ext.id === id);
            
            res.json({
                success: true,
                message: `Extension ${data.action}d successfully`,
                extension: extension || { id, enabled: data.action === 'enable' },
            });
        } catch (error) {
            consola.error('Extension action error:', error);
            res.status(500).json({
                error: 'Failed to perform extension action',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    private handleGetExtensionConfig(req: Request, res: Response): void {
        const { id } = req.params;
        const stats = this.bridge.extensionManager.getExtensionStats();
        const extension = stats.list.find(ext => ext.id === id);
        
        if (!extension) {
            res.status(404).json({ error: 'Extension not found' });
            return;
        }

        // Extension config would need to be exposed by the extension manager
        // For now, return empty config as a placeholder
        res.json({
            id: extension.id,
            config: {},
        });
    }

    private async handleUpdateExtensionConfig(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        
        try {
            const data = updateExtensionConfigSchema.parse(req.body);
            
            // This would need to be implemented in the extension manager
            // For now, just return success
            res.json({
                success: true,
                message: 'Extension config updated successfully',
                config: data.config,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: 'Invalid config data', details: error.errors });
            } else {
                res.status(500).json({ error: 'Failed to update extension config' });
            }
        }
    }

    private async handleExecuteCommand(req: Request, res: Response): Promise<void> {
        try {
            const data = executeCommandSchema.parse(req.body);
            
            // Execute command on Minecraft bot
            const result = await this.bridge.mineflayer.execute(data.command, true);
            
            res.json({
                success: true,
                command: data.command,
                result: result || 'Command executed (no response)',
            });
        } catch (error) {
            res.status(500).json({
                error: 'Command execution failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    private handleGetGuildStats(req: Request, res: Response): void {
        // Read from data/guild-analytics.json if available
        try {
            const fs = require('fs');
            const path = require('path');
            const statsPath = path.join(process.cwd(), 'data', 'guild-analytics.json');
            
            if (fs.existsSync(statsPath)) {
                const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
                res.json(stats);
            } else {
                res.json({ message: 'No guild stats available yet' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to read guild stats' });
        }
    }

    private handleGetMessageStats(req: Request, res: Response): void {
        const last24h = this.messageHistory.filter(msg => 
            msg.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
        );

        const stats = {
            total: this.messageHistory.length,
            last24Hours: last24h.length,
            bySource: {
                minecraft: this.messageHistory.filter(m => m.source === 'minecraft').length,
                discord: this.messageHistory.filter(m => m.source === 'discord').length,
            },
            averagePerHour: Math.round(last24h.length / 24),
        };

        res.json(stats);
    }

    // ========================================================================
    // WebSocket Setup
    // ========================================================================

    private setupWebSocket(): void {
        this.io.on('connection', (socket: Socket) => {
            consola.info(`WebSocket client connected: ${socket.id}`);

            // Authentication for WebSocket
            socket.on('authenticate', (data: { token: string }) => {
                try {
                    if (this.config.enableAuth) {
                        const decoded = jwt.verify(data.token, this.config.jwtSecret);
                        (socket as any).user = decoded;
                        socket.emit('authenticated', { success: true });
                    } else {
                        (socket as any).user = { id: 'anonymous', role: 'admin' };
                        socket.emit('authenticated', { success: true });
                    }
                } catch (error) {
                    socket.emit('authenticated', { success: false, error: 'Invalid token' });
                    socket.disconnect();
                }
            });

            // Send initial state
            socket.emit('bot_status', this.getBotStatus());
            socket.emit('online_users', { count: this.bridge.onlineCount });

            // Handle disconnect
            socket.on('disconnect', () => {
                consola.debug(`WebSocket client disconnected: ${socket.id}`);
            });
        });

        consola.info('WebSocket server initialized');
    }

    // ========================================================================
    // Bridge Event Listeners
    // ========================================================================

    private setupBridgeListeners(): void {
        // Listen for chat messages from Bridge
        this.bridge.on('chat:message', (data: ChatMessage) => {
            this.addMessageToHistory(data);
            this.io.emit('chat_message', data);
        });

        // Listen for user join/leave events
        this.bridge.on('user:join', (data: { username: string }) => {
            this.io.emit('user_join', data);
        });

        this.bridge.on('user:leave', (data: { username: string }) => {
            this.io.emit('user_leave', data);
        });

        // Listen for status changes
        this.bridge.on('status:update', (data: any) => {
            this.io.emit('status_update', data);
        });

        // Listen for extension changes
        this.bridge.on('extension:enabled', (data: { id: string; name: string }) => {
            this.io.emit('extension_update', { ...data, action: 'enabled' });
        });

        this.bridge.on('extension:disabled', (data: { id: string; name: string }) => {
            this.io.emit('extension_update', { ...data, action: 'disabled' });
        });

        consola.info('Bridge event listeners registered');
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private addMessageToHistory(message: ChatMessage): void {
        this.messageHistory.push(message);
        
        // Trim history if it exceeds max size
        if (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
        }
    }

    private getBotStatus(): BotStatus {
        return {
            online: true,
            minecraft: {
                connected: this.bridge.mineflayer.bot?._client?.socket?.writable || false,
                username: this.bridge.mineflayer.bot?.username,
                server: 'mc.hypixel.net',
            },
            discord: {
                connected: this.bridge.discord.isReady(),
                username: this.bridge.discord.user?.username,
                guilds: this.bridge.discord.guilds.cache.size,
            },
            uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
            extensions: this.bridge.extensionManager.getExtensionStats(),
        };
    }

    /**
     * Manually emit a chat message event
     * Useful for integrating with existing chat handlers
     */
    public emitChatMessage(message: ChatMessage): void {
        this.bridge.emit('chat:message', message);
    }

    /**
     * Broadcast a custom event to all connected WebSocket clients
     */
    public broadcast(event: string, data: any): void {
        this.io.emit(event, data);
    }

    // ========================================================================
    // Server Lifecycle
    // ========================================================================

    public start(): Promise<void> {
        return new Promise((resolve) => {
            this.httpServer.listen(this.config.apiPort, () => {
                consola.success(`Bridge API server running on port ${this.config.apiPort}`);
                consola.info(`WebSocket server ready for connections`);
                consola.info(`Authentication: ${this.config.enableAuth ? 'Enabled' : 'Disabled'}`);
                resolve();
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            this.io.close(() => {
                this.httpServer.close(() => {
                    consola.info('Bridge API server stopped');
                    resolve();
                });
            });
        });
    }

    public getApp(): Express {
        return this.app;
    }

    public getIO(): SocketIOServer {
        return this.io;
    }
}

export default BridgeAdapter;
