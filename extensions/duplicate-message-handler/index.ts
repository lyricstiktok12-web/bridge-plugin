/**
 * Duplicate Message Handler Extension
 * 
 * Detects when the bot receives "You cannot say the same message twice!" error
 * and responds with a varied, random alternative message to avoid repetitive responses.
 * 
 * Configuration Options:
 * - enabled: Enable/disable the extension (default: true)
 * - responses: Array of alternative responses to use instead of the default message
 * 
 * @author MiscGuild Bridge Bot Team
 * @version 1.0.0
 */

interface ChatMessageContext {
    message: string;
    username: string;
    channel?: 'Guild' | 'Officer' | 'From' | 'Party' | string;
    rank?: string;
    guildRank?: string;
    timestamp: Date;
    raw: string;
    matches?: RegExpMatchArray;
}

interface ExtensionAPI {
    log: any;
    events: any;
    config: any;
    chat: {
        sendGuildChat: (message: string) => void;
        sendOfficerChat: (message: string) => void;
        sendPrivateMessage: (username: string, message: string) => void;
        sendPartyMessage: (message: string) => void;
    };
    discord: {
        sendMessage: (channelId: string, content: any) => Promise<any>;
        sendEmbed: (channelId: string, embed: any) => Promise<any>;
    };
    utils: Record<string, any>;
}

interface ChatPattern {
    id: string;
    extensionId: string;
    pattern: RegExp;
    priority: number;
    description: string;
    handler: (context: ChatMessageContext, api: ExtensionAPI) => Promise<void> | void;
}

class DuplicateMessageHandlerExtension {
    manifest = {
        id: 'duplicate-message-handler',
        name: 'Duplicate Message Handler',
        version: '1.0.0',
        description: 'Handles duplicate message errors with varied responses',
        author: 'MiscGuild Bridge Bot Team'
    };

    private config: any = {};
    private lastCommandUser: string | null = null;
    private lastCommandChannel: 'Guild' | 'Officer' | 'From' | null = null;
    private api: ExtensionAPI | null = null;

    // Default configuration
    private defaultConfig = {
        enabled: true,
        responses: [
            "I'm sorry, but I can't say the same message twice!",
            "Oops! Hypixel won't let me repeat that message.",
            "My bad! I just tried to send the exact same thing again.",
            "Whoops! Hypixel is blocking duplicate messages.",
            "Sorry about that! Can't send identical messages back-to-back.",
            "Apologies! Hypixel prevents me from repeating messages.",
            "Darn! I tried to say the same thing twice by accident.",
            "Uh oh! Hypixel caught me trying to duplicate a message.",
            "Sorry! The anti-spam system blocked my repeated message.",
            "My mistake! Hypixel doesn't allow identical consecutive messages."
        ]
    };

    async init(context: any, api: ExtensionAPI): Promise<void> {
        this.api = api;
        api.log.info(`Initializing ${this.manifest.name}...`);
        
        // Workaround: Load config directly if not provided by extension system
        let config = api.config || {};
        
        if (!config || Object.keys(config).length === 0) {
            api.log.warn(`${this.manifest.name}: No config provided by extension system, attempting direct load`);
            try {
                const fs = require('fs');
                const path = require('path');
                // Go one level up from dist/ to find config.json in the extension directory
                const configPath = path.join(__dirname, '..', 'config.json');
                
                if (fs.existsSync(configPath)) {
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    config = JSON.parse(configContent);
                    api.log.info(`${this.manifest.name}: Successfully loaded config directly`);
                } else {
                    api.log.error(`${this.manifest.name}: Config file not found at ${configPath}`);
                }
            } catch (error) {
                api.log.error(`${this.manifest.name}: Failed to load config directly:`, error);
            }
        }
        
        // Validate and set configuration
        this.config = this.validateConfig(config, api);
        
        // Check if extension is disabled
        if (this.config.enabled === false) {
            api.log.warn(`${this.manifest.name} is disabled in configuration`);
            return;
        }

        api.log.success(`${this.manifest.name} initialized successfully`);
        api.log.info(`${this.manifest.name} enabled with ${this.config.responses.length} alternative responses`);
    }

    /**
     * Validate and merge configuration with defaults
     */
    private validateConfig(config: any, api: ExtensionAPI): any {
        const mergedConfig = { ...this.defaultConfig, ...config };
        
        // Validate responses array
        if (!Array.isArray(mergedConfig.responses) || mergedConfig.responses.length === 0) {
            api.log.warn(`${this.manifest.name}: No responses configured! Using default responses.`);
            mergedConfig.responses = this.defaultConfig.responses;
        }
        
        return mergedConfig;
    }

    /**
     * Get chat patterns for detecting the duplicate message error
     */
    getChatPatterns(): ChatPattern[] {
        return [
            {
                id: 'track-guild-commands',
                extensionId: 'duplicate-message-handler',
                pattern: /^Guild > (?:\[[^\]]+\]\s+)?([A-Za-z0-9_]{3,16})(?:\s+\[[^\]]+\])?:\s*(!.+)$/,
                priority: 1000, // Very low priority so it doesn't interfere with other handlers
                description: 'Track who made the last command in guild chat',
                handler: (context, api) => this.trackCommandUser(context, api, 'Guild')
            },
            {
                id: 'track-officer-commands',
                extensionId: 'duplicate-message-handler',
                pattern: /^Officer > (?:\[[^\]]+\]\s+)?([A-Za-z0-9_]{3,16})(?:\s+\[[^\]]+\])?:\s*(!.+)$/,
                priority: 1000, // Very low priority so it doesn't interfere with other handlers
                description: 'Track who made the last command in officer chat',
                handler: (context, api) => this.trackCommandUser(context, api, 'Officer')
            },
            {
                id: 'track-dm-commands',
                extensionId: 'duplicate-message-handler',
                pattern: /^From (?:\[[^\]]+\]\s+)?([A-Za-z0-9_]{3,16})(?:\s+\[[^\]]+\])?:\s*(!.+)$/,
                priority: 1000, // Very low priority so it doesn't interfere with other handlers
                description: 'Track who made the last command in DM',
                handler: (context, api) => this.trackCommandUser(context, api, 'From')
            },
            {
                id: 'duplicate-message-error',
                extensionId: 'duplicate-message-handler',
                pattern: /^You cannot say the same message twice!$/,
                priority: 1,
                description: 'Detect duplicate message errors and respond with alternatives',
                handler: this.handleDuplicateMessage.bind(this)
            }
        ];
    }

    /**
     * Track which user made the last command and which channel it was in
     */
    private async trackCommandUser(context: ChatMessageContext, api: ExtensionAPI, channel: 'Guild' | 'Officer' | 'From'): Promise<void> {
        if (!this.config.enabled) return;
        
        // Extract username from the match
        if (context.matches && context.matches[1]) {
            this.lastCommandUser = context.matches[1];
            this.lastCommandChannel = channel;
            api.log.debug(`${this.manifest.name}: Tracked command from ${this.lastCommandUser} in ${channel} chat`);
        }
    }

    /**
     * Handle the duplicate message error
     */
    private async handleDuplicateMessage(context: ChatMessageContext, api: ExtensionAPI): Promise<void> {
        if (!this.config.enabled) return;

        api.log.debug(`${this.manifest.name}: Detected duplicate message error`);

        // Get a random response from the configured alternatives
        const randomResponse = this.getRandomResponse();
        const hexColor = this.getRandomHexColor();
        const message = `${randomResponse} | ${hexColor}`;

        // Send the response to the same channel where the command was sent
        if (this.lastCommandChannel === 'Guild') {
            api.chat.sendGuildChat(message);
            api.log.info(`${this.manifest.name}: Sent alternative response to Guild chat`);
        } else if (this.lastCommandChannel === 'Officer') {
            api.chat.sendOfficerChat(message);
            api.log.info(`${this.manifest.name}: Sent alternative response to Officer chat`);
        } else if (this.lastCommandChannel === 'From' && this.lastCommandUser) {
            api.chat.sendPrivateMessage(this.lastCommandUser, message);
            api.log.info(`${this.manifest.name}: Sent alternative response to ${this.lastCommandUser} via DM`);
        } else {
            // Fallback to guild chat if we don't know the channel
            api.chat.sendGuildChat(message);
            api.log.warn(`${this.manifest.name}: Unknown channel, sent to Guild chat as fallback`);
        }
    }

    /**
     * Get a random response from the configured alternatives
     */
    private getRandomResponse(): string {
        const responses = this.config.responses || this.defaultConfig.responses;
        if (responses.length === 0) {
            return "I'm sorry, but I can't say the same message twice!";
        }
        
        const randomIndex = Math.floor(Math.random() * responses.length);
        return responses[randomIndex];
    }

    /**
     * Generate a random hex color
     */
    private getRandomHexColor(): string {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }
}

module.exports = DuplicateMessageHandlerExtension;
