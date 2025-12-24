/**
 * Guild Event Tracker Extension v1.0
 * 
 * Track GEXP and game statistics for all guild members over a defined time period
 * 
 * Commands:
 * - !startevent <name> <startDate> <endDate> <interval> - Start tracking event (GM/Leader only)
 * - !stopevent - Stop current event (GM/Leader only)
 * - !dailyeventreport - Manually trigger daily report to Discord (GM/Leader only)
 * - !saveeventdata - Manually save event data between intervals (GM/Leader only)
 * - !eventstatus - Show current event status
 * 
 * Example: !startevent "December Challenge" 2025-12-01 2026-01-01 2h
 * 
 * Tracks: GEXP, Bedwars, SkyWars, Cops and Crims, Network Level
 * 
 * @author MiscGuild Bridge Bot Team
 * @version 1.0.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ExtensionAPI {
    log: {
        info: (message: string) => void;
        error: (message: string) => void;
        warn: (message: string) => void;
        success: (message: string) => void;
        debug: (message: string) => void;
    };
    chat: {
        sendGuildChat: (message: string) => void;
        sendOfficerChat: (message: string) => void;
        sendPrivateMessage: (username: string, message: string) => void;
    };
    discord?: {
        sendMessage: (channelId: string, content: string) => Promise<void>;
        sendEmbed: (channelId: string, embed: any) => Promise<void>;
    };
    config?: any;
}

interface ChatMessageContext {
    username: string;
    message: string;
    channel: 'Guild' | 'Officer' | 'From';
    guildRank?: string;
    matches?: RegExpMatchArray | null;
}

interface ChatPattern {
    id: string;
    extensionId: string;
    pattern: RegExp;
    priority: number;
    description: string;
    handler: (context: ChatMessageContext, api: ExtensionAPI) => Promise<void>;
}

interface EventConfig {
    name: string;
    startDate: string; // ISO date
    endDate: string; // ISO date
    updateInterval: number; // in milliseconds
    active: boolean;
    createdBy: string;
    trackedStats: string[];
}

interface PlayerStats {
    uuid: string;
    username: string;
    timestamp: number;
    gexp: {
        weekly: number;
        daily: number;
    };
    bedwars?: {
        wins: number;
        losses: number;
        final_kills: number;
        final_deaths: number;
        kills: number;
        deaths: number;
    };
    skywars?: {
        wins: number;
        losses: number;
        kills: number;
        deaths: number;
    };
    copsandcrims?: {
        wins: number;
        kills: number;
        deaths: number;
        headshot_kills: number;
    };
    networkLevel?: number;
}

interface DailySummary {
    date: string;
    totalPlayers: number;
    totalGexpGained: number;
    topGexpGainers: Array<{ username: string; gained: number }>;
    topBedwarsWins: Array<{ username: string; wins: number }>;
    topSkywarsWins: Array<{ username: string; wins: number }>;
    topNetworkLevelGain: Array<{ username: string; gained: number }>;
    dailyWinner?: string;
    weeklyWinner?: string;
    dayNumber?: number;
}

interface GiveawayData {
    dailyWinners: Array<{ date: string; winner: string; dayNumber: number }>;
    weeklyWinners: Array<{ weekNumber: number; winner: string; startDate: string; endDate: string }>;
    dailyPools: Array<{ date: string; dayNumber: number; eligiblePlayers: string[] }>;
}

interface MojangProfile {
    id: string;
    name: string;
}

interface HypixelPlayer {
    uuid: string;
    displayname: string;
    networkExp?: number;
    stats?: {
        Bedwars?: any;
        SkyWars?: any;
        MCGO?: any; // Cops and Crims
    };
}

interface GuildMember {
    uuid: string;
    rank?: string;
    joined?: number;
    expHistory?: { [date: string]: number };
}

interface HypixelGuild {
    name: string;
    members: GuildMember[];
}

class GuildEventTrackerExtension {
    private api!: ExtensionAPI;
    private config: any;
    private eventConfig: EventConfig | null = null;
    private giveawayData: GiveawayData = { dailyWinners: [], weeklyWinners: [], dailyPools: [] };
    private updateTimer: NodeJS.Timeout | null = null;
    private dailyReportTimer: NodeJS.Timeout | null = null;
    private dataDir: string;
    private eventDir: string;
    private discordChannelId = '761227927583981598';
    private hypixelApiKeys: string[] = [];
    private currentKeyIndex: number = 0;
    private requestCount: number = 0; // Track requests for key rotation
    private botUuidCache?: string; // Cache bot UUID to avoid rate limiting

    constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.eventDir = path.join(this.dataDir, 'event');
        this.config = {};
    }

    async init(context: any, api: ExtensionAPI): Promise<void> {
        this.api = api;
        this.api.log.info('Initializing Guild Event Tracker Extension...');

        // Load Hypixel API keys from environment (use fallback keys for event tracker)
        const fallbackKey = process.env.FALLBACK_HYPIXEL_API_KEY || '';
        const secondFallbackKey = process.env['2ND_FALLBACK_HYPIXEL_API_KEY'] || '';
        
        if (fallbackKey) this.hypixelApiKeys.push(fallbackKey);
        if (secondFallbackKey) this.hypixelApiKeys.push(secondFallbackKey);
        
        if (this.hypixelApiKeys.length === 0) {
            this.api.log.warn('No fallback Hypixel API keys found in environment variables');
        } else {
            this.api.log.info(`Loaded ${this.hypixelApiKeys.length} fallback Hypixel API key(s) for event tracker`);
        }

        // Ensure data directories exist
        await this.ensureDirectories();

        // Load existing event config if any
        await this.loadEventConfig();
        await this.loadGiveawayData();

        // If event is active, resume tracking
        if (this.eventConfig && this.eventConfig.active) {
            await this.resumeEvent();
        }

        // Set up shutdown hooks to save data before bot exits
        this.setupShutdownHooks();

        this.api.log.success('Guild Event Tracker Extension initialized successfully');
    }

    private async ensureDirectories(): Promise<void> {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.mkdir(this.eventDir, { recursive: true });
        } catch (error) {
            this.api.log.error(`Failed to create directories: ${error}`);
        }
    }

    private getNextApiKey(): string {
        if (this.hypixelApiKeys.length === 0) return '';
        
        // Rotate to next key every 65 requests
        if (this.requestCount > 0 && this.requestCount % 65 === 0) {
            this.currentKeyIndex = (this.currentKeyIndex + 1) % this.hypixelApiKeys.length;
            this.api.log.info(`Rotated to API key ${this.currentKeyIndex + 1} after ${this.requestCount} requests`);
        }
        
        this.requestCount++;
        return this.hypixelApiKeys[this.currentKeyIndex] || '';
    }

    private async loadEventConfig(): Promise<void> {
        const configPath = path.join(this.eventDir, 'event-config.json');
        try {
            const data = await fs.readFile(configPath, 'utf-8');
            this.eventConfig = JSON.parse(data);
            this.api.log.info(`Loaded event config: ${this.eventConfig?.name}`);
        } catch (error) {
            this.api.log.info('No active event found');
        }
    }

    private async saveEventConfig(): Promise<void> {
        if (!this.eventConfig) return;

        const configPath = path.join(this.eventDir, 'event-config.json');
        try {
            await fs.writeFile(configPath, JSON.stringify(this.eventConfig, null, 2));
            this.api.log.success('Event config saved');
        } catch (error) {
            this.api.log.error(`Failed to save event config: ${error}`);
        }
    }

    private async loadGiveawayData(): Promise<void> {
        const giveawayPath = path.join(this.eventDir, 'giveaway-data.json');
        try {
            const data = await fs.readFile(giveawayPath, 'utf-8');
            this.giveawayData = JSON.parse(data);
            this.api.log.info(`Loaded giveaway data: ${this.giveawayData.dailyWinners.length} daily, ${this.giveawayData.weeklyWinners.length} weekly winners`);
        } catch (error) {
            this.api.log.info('No giveaway data found, starting fresh');
            this.giveawayData = { dailyWinners: [], weeklyWinners: [], dailyPools: [] };
        }
    }

    private async saveGiveawayData(): Promise<void> {
        const giveawayPath = path.join(this.eventDir, 'giveaway-data.json');
        try {
            await fs.writeFile(giveawayPath, JSON.stringify(this.giveawayData, null, 2));
            this.api.log.success('Giveaway data saved');
        } catch (error) {
            this.api.log.error(`Failed to save giveaway data: ${error}`);
        }
    }

    private async resumeEvent(): Promise<void> {
        if (!this.eventConfig || !this.eventConfig.active) return;

        this.api.log.info(`Resuming event: ${this.eventConfig.name}`);
        this.startUpdateTimer();
        this.startDailyReportTimer();
    }

    /**
     * Set up hooks to save event data when bot shuts down
     */
    private setupShutdownHooks(): void {
        // Save data on process exit
        const saveOnExit = async () => {
            if (this.eventConfig && this.eventConfig.active) {
                this.api.log.info('Saving event data before shutdown...');
                try {
                    await this.updateAllMembers();
                    await this.saveEventConfig();
                    await this.saveGiveawayData();
                    this.api.log.success('Event data saved successfully');
                } catch (error) {
                    this.api.log.error(`Failed to save event data: ${error}`);
                }
            }
        };

        // Listen for process exit signals
        process.on('SIGINT', saveOnExit);
        process.on('SIGTERM', saveOnExit);
        process.on('beforeExit', saveOnExit);
    }

    private startUpdateTimer(): void {
        if (!this.eventConfig) return;

        // Clear existing timer
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        // Start periodic updates
        this.updateTimer = setInterval(async () => {
            await this.updateAllMembers();
        }, this.eventConfig.updateInterval);

        this.api.log.info(`Update timer started (interval: ${this.eventConfig.updateInterval}ms)`);
    }

    private startDailyReportTimer(): void {
        // Clear existing timer
        if (this.dailyReportTimer) {
            clearInterval(this.dailyReportTimer);
        }

        // Calculate time until next midnight
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const timeUntilMidnight = tomorrow.getTime() - now.getTime();

        // Schedule first report at midnight
        setTimeout(async () => {
            await this.generateDailyReport();

            // Then repeat every 24 hours
            this.dailyReportTimer = setInterval(async () => {
                await this.generateDailyReport();
            }, 24 * 60 * 60 * 1000);
        }, timeUntilMidnight);

        this.api.log.info('Daily report timer started');
    }

    private parseInterval(interval: string): number {
        const match = interval.match(/^(\d+)(m|h|d)$/i);
        if (!match || !match[1] || !match[2]) {
            throw new Error('Invalid interval format. Use format like: 2h, 30m, 1d');
        }

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: throw new Error('Invalid time unit');
        }
    }

    private async handleStartEvent(context: ChatMessageContext, api: ExtensionAPI): Promise<void> {
        // Check permissions
        if (!['Leader', 'GM', 'Guild Master'].includes(context.guildRank || '')) {
            this.sendToChannel(context, api, 'Only Guild Masters and Leaders can start events! | #ff0000');
            return;
        }

        // Check if event already active
        if (this.eventConfig && this.eventConfig.active) {
            this.sendToChannel(context, api, `An event is already active: ${this.eventConfig.name}. Use !stopevent first. | #ff9900`);
            return;
        }

        const parts = context.message.split(' ');
        if (parts.length < 5) {
            this.sendToChannel(context, api, 'Usage: !startevent <name> <startDate> <endDate> <update interval>');
            this.sendToChannel(context, api, 'Example: !startevent "December Challenge" 2025-12-01 2026-01-01 2h');
            return;
        }

        try {
            // Parse event name (might be quoted)
            let nameEndIndex = 1;
            let eventName = parts[1] || '';
            
            if (eventName.startsWith('"')) {
                // Find closing quote
                for (let i = 2; i < parts.length; i++) {
                    const part = parts[i];
                    if (!part) continue;
                    eventName += ' ' + part;
                    nameEndIndex = i;
                    if (part.endsWith('"')) break;
                }
                eventName = eventName.replace(/^"|"$/g, '');
            }

            const startDate = parts[nameEndIndex + 1];
            const endDate = parts[nameEndIndex + 2];
            const intervalStr = parts[nameEndIndex + 3];

            if (!startDate || !endDate || !intervalStr) {
                throw new Error('Missing required parameters');
            }

            // Validate dates
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('Invalid date format. Use YYYY-MM-DD');
            }

            if (end <= start) {
                throw new Error('End date must be after start date');
            }

            const interval = this.parseInterval(intervalStr);

            // Create event config
            this.eventConfig = {
                name: eventName,
                startDate: startDate,
                endDate: endDate,
                updateInterval: interval,
                active: true,
                createdBy: context.username,
                trackedStats: ['gexp', 'bedwars', 'skywars', 'copsandcrims', 'networkLevel']
            };

            await this.saveEventConfig();

            // Clear old event data
            await this.clearEventData();

            // Capture baseline stats (day0.json) for all guild members
            this.api.log.info('Capturing event start baseline...');
            await this.captureBaseline();

            // Start tracking
            this.startUpdateTimer();
            this.startDailyReportTimer();

            this.sendToChannel(context, api, `Event "${eventName}" started! Tracking from ${startDate} to ${endDate} with ${intervalStr} updates. Baseline captured! | #00ff00`);
            api.log.success(`Event started by ${context.username}: ${eventName}`);

        } catch (error: any) {
            this.sendToChannel(context, api, `Error starting event: ${error.message} | #ff0000`);
            api.log.error(`Failed to start event: ${error}`);
        }
    }

    private async handleStopEvent(context: ChatMessageContext, api: ExtensionAPI): Promise<void> {
        // Check permissions
        if (!['Leader', 'GM', 'Guild Master'].includes(context.guildRank || '')) {
            this.sendToChannel(context, api, 'Only Guild Masters and Leaders can stop events! | #ff0000');
            return;
        }

        if (!this.eventConfig || !this.eventConfig.active) {
            this.sendToChannel(context, api, 'No active event to stop. | #ff9900');
            return;
        }

        const eventName = this.eventConfig.name;

        // Stop timers
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        if (this.dailyReportTimer) {
            clearInterval(this.dailyReportTimer);
            this.dailyReportTimer = null;
        }

        // Mark as inactive
        this.eventConfig.active = false;
        await this.saveEventConfig();

        // Generate final report
        await this.generateDailyReport(true);

        this.sendToChannel(context, api, `Event "${eventName}" stopped! Final report generated. | #00ff00`);
        api.log.success(`Event stopped by ${context.username}: ${eventName}`);
    }

    private async handleDailyReport(context: ChatMessageContext, api: ExtensionAPI): Promise<void> {
        // Check permissions
        if (!['Leader', 'GM', 'Guild Master'].includes(context.guildRank || '')) {
            this.sendToChannel(context, api, 'Only Guild Masters and Leaders can trigger reports! | #ff0000');
            return;
        }

        if (!this.eventConfig || !this.eventConfig.active) {
            this.sendToChannel(context, api, 'No active event. Start one with !startevent first. | #ff9900');
            return;
        }

        this.sendToChannel(context, api, 'Generating daily report...');
        await this.generateDailyReport();
        this.sendToChannel(context, api, 'Daily report sent to Discord! | #00ff00');
    }

    private async handleSaveEventData(context: ChatMessageContext, api: ExtensionAPI): Promise<void> {
        // Check permissions
        if (!['Leader', 'GM', 'Guild Master'].includes(context.guildRank || '')) {
            this.sendToChannel(context, api, 'Only Guild Masters and Leaders can manually save event data! | #ff0000');
            return;
        }

        if (!this.eventConfig || !this.eventConfig.active) {
            this.sendToChannel(context, api, 'No active event. Start one with !startevent first. | #ff9900');
            return;
        }

        this.sendToChannel(context, api, 'Manually saving event data...');
        api.log.info('Starting manual member stats update...');
        
        try {
            await this.updateAllMembers();
            this.sendToChannel(context, api, 'Event data saved successfully! | #00ff00');
            api.log.success('Manual event data save completed');
        } catch (error) {
            api.log.error(`Failed to manually save event data: ${error}`);
            this.sendToChannel(context, api, 'Failed to save event data. Check logs for details. | #ff0000');
        }
    }

    private async handleEventStatus(context: ChatMessageContext, api: ExtensionAPI): Promise<void> {
        if (!this.eventConfig) {
            this.sendToChannel(context, api, 'No event configured. Use !startevent to create one. | #999999');
            return;
        }

        const status = this.eventConfig.active ? 'Active' : 'Inactive';
        const intervalStr = this.formatInterval(this.eventConfig.updateInterval);
        
        this.sendToChannel(context, api, `Event: ${this.eventConfig.name} | Status: ${status}`);
        this.sendToChannel(context, api, `Period: ${this.eventConfig.startDate} to ${this.eventConfig.endDate}`);
        this.sendToChannel(context, api, `Update Interval: ${intervalStr} | Created by: ${this.eventConfig.createdBy}`);
    }

    /**
     * Handle pre-reboot save - saves event data before bot restarts
     * This handler runs with priority 1 so it executes before the staff-management reboot handler
     */
    private async handlePreReboot(context: ChatMessageContext, api: ExtensionAPI): Promise<void> {
        // Only save if event is active
        if (!this.eventConfig || !this.eventConfig.active) {
            return;
        }

        api.log.info('Saving event data before reboot...');
        
        try {
            // Save current state
            await this.updateAllMembers();
            await this.saveEventConfig();
            await this.saveGiveawayData();
            api.log.success('Event data saved before reboot');
        } catch (error) {
            api.log.error(`Failed to save event data before reboot: ${error}`);
        }
        
        // Don't send any messages - let the staff-management extension handle the reboot notification
    }

    private formatInterval(ms: number): string {
        const hours = Math.floor(ms / (60 * 60 * 1000));
        const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
        
        if (hours > 0 && minutes > 0) {
            return `${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${minutes}m`;
        }
    }

    private async clearEventData(): Promise<void> {
        try {
            // Remove all player data directories
            const entries = await fs.readdir(this.eventDir);
            for (const entry of entries) {
                const entryPath = path.join(this.eventDir, entry);
                const stat = await fs.stat(entryPath);
                if (stat.isDirectory()) {
                    await fs.rm(entryPath, { recursive: true, force: true });
                }
            }

            // Remove overall.json if exists
            const overallPath = path.join(this.eventDir, 'overall.json');
            try {
                await fs.unlink(overallPath);
            } catch (error) {
                // File may not exist, ignore error
            }

            // Remove giveaway data
            const giveawayPath = path.join(this.eventDir, 'giveaway-data.json');
            try {
                await fs.unlink(giveawayPath);
            } catch (error) {
                // File may not exist, ignore error
            }

            // Reset giveaway data in memory
            this.giveawayData = { dailyWinners: [], weeklyWinners: [], dailyPools: [] };

            this.api.log.info('Cleared old event data and giveaway data');
        } catch (error) {
            this.api.log.error(`Failed to clear event data: ${error}`);
        }
    }

    private async captureBaseline(): Promise<void> {
        if (!this.eventConfig) return;

        try {
            // Fetch guild data
            const guild = await this.fetchGuildData();
            if (!guild || !guild.members) {
                this.api.log.error('Failed to fetch guild data for baseline');
                return;
            }

            let successCount = 0;
            let errorCount = 0;

            // Capture baseline for each member (day0.json)
            for (const member of guild.members) {
                try {
                    await this.captureBaselineForMember(member.uuid);
                    successCount++;
                    
                    // Rate limiting - wait 10 seconds between requests
                    await this.sleep(10000);
                } catch (error) {
                    errorCount++;
                    this.api.log.error(`Failed to capture baseline for ${member.uuid}: ${error}`);
                }
            }

            this.api.log.success(`Captured baseline for ${successCount} members (${errorCount} errors)`);

        } catch (error) {
            this.api.log.error(`Baseline capture failed: ${error}`);
        }
    }

    private async captureBaselineForMember(uuid: string): Promise<void> {
        // eslint-disable-next-line no-useless-catch
        try {
            // Fetch player data
            const playerData = await this.fetchHypixelPlayer(uuid);
            if (!playerData) {
                throw new Error('Failed to fetch player data');
            }

            const stats: PlayerStats = {
                uuid: uuid,
                username: playerData.displayname,
                timestamp: Date.now(),
                gexp: {
                    weekly: this.calculateWeeklyGexp(uuid, await this.fetchGuildData()),
                    daily: this.calculateDailyGexp(uuid, await this.fetchGuildData())
                },
                networkLevel: this.calculateNetworkLevel(playerData.networkExp || 0)
            };

            // Add Bedwars stats
            if (playerData.stats?.Bedwars) {
                stats.bedwars = {
                    wins: playerData.stats.Bedwars.wins_bedwars || 0,
                    losses: playerData.stats.Bedwars.losses_bedwars || 0,
                    final_kills: playerData.stats.Bedwars.final_kills_bedwars || 0,
                    final_deaths: playerData.stats.Bedwars.final_deaths_bedwars || 0,
                    kills: playerData.stats.Bedwars.kills_bedwars || 0,
                    deaths: playerData.stats.Bedwars.deaths_bedwars || 0
                };
            }

            // Add SkyWars stats
            if (playerData.stats?.SkyWars) {
                stats.skywars = {
                    wins: playerData.stats.SkyWars.wins || 0,
                    losses: playerData.stats.SkyWars.losses || 0,
                    kills: playerData.stats.SkyWars.kills || 0,
                    deaths: playerData.stats.SkyWars.deaths || 0
                };
            }

            // Add Cops and Crims stats
            if (playerData.stats?.MCGO) {
                stats.copsandcrims = {
                    wins: playerData.stats.MCGO.game_wins || 0,
                    kills: playerData.stats.MCGO.kills || 0,
                    deaths: playerData.stats.MCGO.deaths || 0,
                    headshot_kills: playerData.stats.MCGO.headshot_kills || 0
                };
            }

            // Save as day0.json (baseline)
            const fullUuid = stats.uuid.replace(/-/g, '');
            const playerDir = path.join(this.eventDir, fullUuid);
            await fs.mkdir(playerDir, { recursive: true });

            const baselinePath = path.join(playerDir, 'day0.json');
            await fs.writeFile(baselinePath, JSON.stringify(stats, null, 2));

        } catch (error) {
            // Re-throw to be handled by caller to avoid ESLint errors
            throw error;
        }
    }

    private async updateAllMembers(): Promise<void> {
        if (!this.eventConfig || !this.eventConfig.active) return;

        this.api.log.info('Starting member stats update...');

        try {
            // Fetch guild data
            const guild = await this.fetchGuildData();
            if (!guild || !guild.members) {
                this.api.log.error('Failed to fetch guild data');
                return;
            }

            let successCount = 0;
            let errorCount = 0;

            // Update each member
            for (const member of guild.members) {
                try {
                    await this.updateMemberStats(member.uuid);
                    successCount++;
                    
                    // Rate limiting - wait 10 seconds between requests
                    await this.sleep(10000);
                } catch (error) {
                    errorCount++;
                    this.api.log.error(`Failed to update ${member.uuid}: ${error}`);
                }
            }

            this.api.log.success(`Updated ${successCount} members (${errorCount} errors)`);

        } catch (error) {
            this.api.log.error(`Update all members failed: ${error}`);
        }
    }

    private async updateMemberStats(uuid: string): Promise<void> {
        // eslint-disable-next-line no-useless-catch
        try {
            // Fetch player data
            const playerData = await this.fetchHypixelPlayer(uuid);
            if (!playerData) {
                throw new Error('Failed to fetch player data');
            }

            const stats: PlayerStats = {
                uuid: uuid,
                username: playerData.displayname,
                timestamp: Date.now(),
                gexp: {
                    weekly: this.calculateWeeklyGexp(uuid, await this.fetchGuildData()),
                    daily: this.calculateDailyGexp(uuid, await this.fetchGuildData())
                },
                networkLevel: this.calculateNetworkLevel(playerData.networkExp || 0)
            };

            // Add Bedwars stats
            if (playerData.stats?.Bedwars) {
                const bw = playerData.stats.Bedwars;
                stats.bedwars = {
                    wins: bw.wins_bedwars || 0,
                    losses: bw.losses_bedwars || 0,
                    final_kills: bw.final_kills_bedwars || 0,
                    final_deaths: bw.final_deaths_bedwars || 0,
                    kills: bw.kills_bedwars || 0,
                    deaths: bw.deaths_bedwars || 0
                };
            }

            // Add SkyWars stats
            if (playerData.stats?.SkyWars) {
                const sw = playerData.stats.SkyWars;
                stats.skywars = {
                    wins: sw.wins || 0,
                    losses: sw.losses || 0,
                    kills: sw.kills || 0,
                    deaths: sw.deaths || 0
                };
            }

            // Add Cops and Crims stats
            if (playerData.stats?.MCGO) {
                const cvc = playerData.stats.MCGO;
                stats.copsandcrims = {
                    wins: (cvc.game_wins || 0),
                    kills: (cvc.kills || 0),
                    deaths: (cvc.deaths || 0),
                    headshot_kills: (cvc.headshot_kills || 0)
                };
            }

            // Save stats
            await this.savePlayerStats(stats);

        } catch (error) {
            throw error;
        }
    }

    private getCurrentDay(config: EventConfig): number {
        const eventStart = new Date(config.startDate);
        const today = new Date();
        return Math.floor((today.getTime() - eventStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    }

    private async savePlayerStats(stats: PlayerStats): Promise<void> {
        // Store full UUID without dashes for directory name
        const fullUuid = stats.uuid.replace(/-/g, '');
        const playerDir = path.join(this.eventDir, fullUuid);
        
        // Ensure player directory exists
        await fs.mkdir(playerDir, { recursive: true });

        // Calculate day number since event start
        const dayNumber = this.getCurrentDay(this.eventConfig!);

        const filename = `day${dayNumber}.json`;
        const filepath = path.join(playerDir, filename);

        await fs.writeFile(filepath, JSON.stringify(stats, null, 2));
    }

    private async generateDailyReport(isFinal: boolean = false): Promise<void> {
        if (!this.eventConfig) return;

        this.api.log.info('Generating daily report...');

        try {
            const summary = await this.compileDailySummary();
            
            // Calculate day number
            const eventStart = new Date(this.eventConfig.startDate);
            const today = new Date();
            const dayNumber = Math.floor((today.getTime() - eventStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            summary.dayNumber = dayNumber;
            
            // Run giveaway for the day
            const dailyWinner = await this.selectDailyWinner(summary);
            if (dailyWinner) {
                summary.dailyWinner = dailyWinner;
                this.giveawayData.dailyWinners.push({
                    date: summary.date,
                    winner: dailyWinner,
                    dayNumber: dayNumber
                });
            }
            
            // Check if it's a weekly giveaway day (every 7th day)
            if (dayNumber % 7 === 0) {
                const weekNumber = Math.floor(dayNumber / 7);
                const weeklyWinner = await this.selectWeeklyWinner(weekNumber);
                if (weeklyWinner) {
                    summary.weeklyWinner = weeklyWinner;
                    
                    // Calculate week dates
                    const weekStart = new Date(eventStart);
                    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    
                    this.giveawayData.weeklyWinners.push({
                        weekNumber: weekNumber,
                        winner: weeklyWinner,
                        startDate: weekStart.toISOString().split('T')[0] || '',
                        endDate: weekEnd.toISOString().split('T')[0] || ''
                    });
                }
            }
            
            await this.saveGiveawayData();
            await this.saveOverallSummary(summary);
            await this.sendDiscordReport(summary, isFinal);
            
            this.api.log.success('Daily report generated and sent');
        } catch (error) {
            this.api.log.error(`Failed to generate daily report: ${error}`);
        }
    }

    private async compileDailySummary(): Promise<DailySummary> {
        if (!this.eventConfig) {
            throw new Error('No active event config');
        }

        const currentDay = this.getCurrentDay(this.eventConfig);
        const summary: DailySummary = {
            date: new Date().toISOString().split('T')[0] || '',
            totalPlayers: 0,
            totalGexpGained: 0,
            topGexpGainers: [],
            topBedwarsWins: [],
            topSkywarsWins: [],
            topNetworkLevelGain: [],
            dayNumber: currentDay
        };

        try {
            const entries = await fs.readdir(this.eventDir);
            // Filter for UUID directories (32 characters, all hex)
            const playerDirs = entries.filter(e => /^[a-f0-9]{32}$/i.test(e));

            this.api.log.info(`Compiling summary for day ${currentDay} from ${playerDirs.length} players`);

            const playerGains: Array<{ username: string; gexp: number; bwWins: number; swWins: number; nwLevel: number }> = [];

            for (const playerDir of playerDirs) {
                const gains = await this.calculatePlayerDailyGains(playerDir, currentDay);
                if (gains) {
                    playerGains.push(gains);
                    summary.totalGexpGained += gains.gexp;
                }
            }

            summary.totalPlayers = playerGains.length; // Only count players with data

            // Sort and get top players
            summary.topGexpGainers = playerGains
                .sort((a, b) => b.gexp - a.gexp)
                .slice(0, 10)
                .map(p => ({ username: p.username, gained: p.gexp }));

            summary.topBedwarsWins = playerGains
                .sort((a, b) => b.bwWins - a.bwWins)
                .slice(0, 10)
                .map(p => ({ username: p.username, wins: p.bwWins }));

            summary.topSkywarsWins = playerGains
                .sort((a, b) => b.swWins - a.swWins)
                .slice(0, 10)
                .map(p => ({ username: p.username, wins: p.swWins }));

            summary.topNetworkLevelGain = playerGains
                .sort((a, b) => b.nwLevel - a.nwLevel)
                .slice(0, 10)
                .map(p => ({ username: p.username, gained: Math.round(p.nwLevel * 100) / 100 }));

            this.api.log.success(`Compiled summary: ${summary.totalPlayers} players, ${summary.totalGexpGained.toFixed(0)} total GEXP`);

        } catch (error) {
            this.api.log.error(`Failed to compile summary: ${error}`);
        }

        return summary;
    }

    private async calculatePlayerDailyGains(playerDir: string, currentDay: number): Promise<{ username: string; gexp: number; bwWins: number; swWins: number; nwLevel: number } | null> {
        try {
            const dirPath = path.join(this.eventDir, playerDir);
            
            // Read today's data
            const todayFile = `day${currentDay}.json`;
            const todayPath = path.join(dirPath, todayFile);
            
            // Check if today's data exists
            try {
                await fs.access(todayPath);
            } catch {
                // No data for today yet
                return null;
            }
            
            const todayData = JSON.parse(await fs.readFile(todayPath, 'utf-8')) as PlayerStats;
            
            // Read baseline data (day0.json) - this is the event start snapshot
            const baselinePath = path.join(dirPath, 'day0.json');
            let baselineData: PlayerStats | null = null;
            
            try {
                baselineData = JSON.parse(await fs.readFile(baselinePath, 'utf-8')) as PlayerStats;
            } catch {
                // If no baseline exists (player joined after event started), use today's data as baseline
                this.api.log.warn(`No baseline for ${playerDir}, player likely joined after event started`);
                return {
                    username: todayData.username,
                    gexp: todayData.gexp.daily || 0,  // Use daily GEXP from API
                    bwWins: 0,  // No baseline to compare
                    swWins: 0,
                    nwLevel: 0
                };
            }
            
            // Calculate gains since event start (comparing current stats vs baseline)
            return {
                username: todayData.username,
                gexp: (todayData.gexp.weekly || 0) - (baselineData.gexp.weekly || 0),
                bwWins: (todayData.bedwars?.wins || 0) - (baselineData.bedwars?.wins || 0),
                swWins: (todayData.skywars?.wins || 0) - (baselineData.skywars?.wins || 0),
                nwLevel: (todayData.networkLevel || 0) - (baselineData.networkLevel || 0)
            };
        } catch (error) {
            this.api.log.error(`Error calculating gains for ${playerDir}: ${error}`);
            return null;
        }
    }

    private async selectDailyWinner(summary: DailySummary): Promise<string | null> {
        try {
            // Calculate average GEXP of all guild members for the day
            const averageGexp = summary.totalPlayers > 0 
                ? summary.totalGexpGained / summary.totalPlayers 
                : 1; // Prevent division by zero
            
            if (averageGexp === 0) {
                this.api.log.warn('Average GEXP is 0, cannot calculate winner');
                return null;
            }
            
            // Build pool of eligible players (anyone in top 10 of any category)
            const eligiblePlayers = new Set<string>();
            summary.topGexpGainers.slice(0, 10).forEach(p => eligiblePlayers.add(p.username));
            summary.topBedwarsWins.slice(0, 10).forEach(p => eligiblePlayers.add(p.username));
            summary.topSkywarsWins.slice(0, 10).forEach(p => eligiblePlayers.add(p.username));
            summary.topNetworkLevelGain.slice(0, 10).forEach(p => eligiblePlayers.add(p.username));
            
            const pool = Array.from(eligiblePlayers);
            
            // Store the daily pool
            if (summary.dayNumber) {
                this.giveawayData.dailyPools.push({
                    date: summary.date,
                    dayNumber: summary.dayNumber,
                    eligiblePlayers: pool
                });
            }
            
            if (pool.length === 0) {
                this.api.log.warn('No eligible players for daily giveaway');
                return null;
            }
            
            // Calculate score for each player using formula:
            // Score = TopGEXP / AverageGEXP
            const playerScores: Array<{ username: string; score: number; gexp: number }> = [];
            
            for (const username of pool) {
                const gexpData = summary.topGexpGainers.find(p => p.username === username);
                const topGexp = gexpData?.gained || 0;
                
                if (topGexp === 0) continue; // Skip players with no GEXP gain
                
                const score = topGexp / averageGexp;
                
                playerScores.push({ username, score, gexp: topGexp });
            }
            
            // Sort by score descending and select winner with highest score
            playerScores.sort((a, b) => b.score - a.score);
            
            const winner = playerScores[0]?.username;
            if (!winner) {
                this.api.log.warn('Could not determine winner');
                return null;
            }
            
            const winnerScore = playerScores[0]?.score || 0;
            const winnerGexp = playerScores[0]?.gexp || 0;
            this.api.log.success(`Daily winner: ${winner} (GEXP: ${winnerGexp.toFixed(0)}, score: ${winnerScore.toFixed(2)}x avg, avg: ${averageGexp.toFixed(0)})`);
            
            return winner;
        } catch (error) {
            this.api.log.error(`Failed to select daily winner: ${error}`);
            return null;
        }
    }

    private async selectWeeklyWinner(weekNumber: number): Promise<string | null> {
        try {
            // Load overall summaries to get week's data
            const overallPath = path.join(this.eventDir, 'overall.json');
            let allSummaries: DailySummary[] = [];
            
            try {
                const data = await fs.readFile(overallPath, 'utf-8');
                allSummaries = JSON.parse(data);
            } catch {
                this.api.log.warn('No overall summaries found for weekly calculation');
                return null;
            }
            
            // Get summaries from the past week
            const startDay = (weekNumber - 1) * 7 + 1;
            const endDay = weekNumber * 7;
            
            const weekSummaries = allSummaries.filter(
                s => s.dayNumber && s.dayNumber >= startDay && s.dayNumber <= endDay
            );
            
            if (weekSummaries.length === 0) {
                this.api.log.warn('No summaries found for weekly giveaway');
                return null;
            }
            
            // Aggregate stats for the week
            const playerWeekStats = new Map<string, { 
                totalGexp: number; 
                totalBwWins: number; 
                totalSwWins: number; 
                totalNwGain: number;
                appearances: number;
            }>();
            
            let weekTotalGexp = 0;
            let weekTotalPlayers = 0;
            
            // Collect all eligible players and their stats across the week
            for (const daySummary of weekSummaries) {
                weekTotalGexp += daySummary.totalGexpGained;
                weekTotalPlayers += daySummary.totalPlayers;
                
                // Process top performers from each category
                const eligiblePlayers = new Set<string>();
                daySummary.topGexpGainers.slice(0, 10).forEach(p => eligiblePlayers.add(p.username));
                daySummary.topBedwarsWins.slice(0, 10).forEach(p => eligiblePlayers.add(p.username));
                daySummary.topSkywarsWins.slice(0, 10).forEach(p => eligiblePlayers.add(p.username));
                daySummary.topNetworkLevelGain.slice(0, 10).forEach(p => eligiblePlayers.add(p.username));
                
                // Aggregate stats for each eligible player
                for (const username of eligiblePlayers) {
                    if (!playerWeekStats.has(username)) {
                        playerWeekStats.set(username, {
                            totalGexp: 0,
                            totalBwWins: 0,
                            totalSwWins: 0,
                            totalNwGain: 0,
                            appearances: 0
                        });
                    }
                    
                    const stats = playerWeekStats.get(username)!;
                    stats.appearances++;
                    
                    const gexpData = daySummary.topGexpGainers.find(p => p.username === username);
                    const bwData = daySummary.topBedwarsWins.find(p => p.username === username);
                    const swData = daySummary.topSkywarsWins.find(p => p.username === username);
                    const nwData = daySummary.topNetworkLevelGain.find(p => p.username === username);
                    
                    stats.totalGexp += gexpData?.gained || 0;
                    stats.totalBwWins += bwData?.wins || 0;
                    stats.totalSwWins += swData?.wins || 0;
                    stats.totalNwGain += nwData?.gained || 0;
                }
            }
            
            // Calculate average GEXP for the week
            const weekAverageGexp = weekTotalPlayers > 0 
                ? weekTotalGexp / (weekTotalPlayers / weekSummaries.length)
                : 1;
            
            if (weekAverageGexp === 0 || playerWeekStats.size === 0) {
                this.api.log.warn('Cannot calculate weekly winner');
                return null;
            }
            
            // Calculate score for each player using formula:
            // Score = WeeklyGEXP / WeekAverageGEXP
            const playerScores: Array<{ username: string; score: number; gexp: number }> = [];
            
            for (const [username, stats] of playerWeekStats.entries()) {
                if (stats.totalGexp === 0) continue; // Skip players with no GEXP gain
                
                const score = stats.totalGexp / weekAverageGexp;
                playerScores.push({ username, score, gexp: stats.totalGexp });
            }
            
            // Sort by score descending and select winner with highest score
            playerScores.sort((a, b) => b.score - a.score);
            
            const winner = playerScores[0]?.username;
            if (!winner) {
                this.api.log.warn('Could not determine weekly winner');
                return null;
            }
            
            const winnerScore = playerScores[0]?.score || 0;
            const winnerGexp = playerScores[0]?.gexp || 0;
            this.api.log.success(`Weekly winner: ${winner} (Week ${weekNumber}, GEXP: ${winnerGexp.toFixed(0)}, score: ${winnerScore.toFixed(2)}x avg, avg: ${weekAverageGexp.toFixed(0)})`);
            
            return winner;
        } catch (error) {
            this.api.log.error(`Failed to select weekly winner: ${error}`);
            return null;
        }
    }

    private async saveOverallSummary(summary: DailySummary): Promise<void> {
        const overallPath = path.join(this.eventDir, 'overall.json');
        
        let allSummaries: DailySummary[] = [];
        
        // Load existing summaries
        try {
            const data = await fs.readFile(overallPath, 'utf-8');
            allSummaries = JSON.parse(data);
        } catch (error) {
            // File may not exist yet, use empty array
        }

        // Add today's summary
        allSummaries.push(summary);

        // Save
        await fs.writeFile(overallPath, JSON.stringify(allSummaries, null, 2));
    }

    private async sendDiscordReport(summary: DailySummary, isFinal: boolean = false): Promise<void> {
        if (!this.api.discord) {
            this.api.log.warn('Discord API not available, skipping report');
            return;
        }

        const title = isFinal ? `Final Event Report: ${this.eventConfig!.name}` : `Daily Event Report: ${this.eventConfig!.name}`;
        
        const fields: any[] = [
            {
                name: 'Players Participating',
                value: summary.totalPlayers.toString(),
                inline: true
            },
            {
                name: 'Total GEXP Gained',
                value: this.formatNumber(summary.totalGexpGained),
                inline: true
            },
            {
                name: 'Report Date',
                value: `${summary.date} (Day ${summary.dayNumber || '?'})`,
                inline: true
            }
        ];

        // Add daily winner if present
        if (summary.dailyWinner) {
            fields.push({
                name: 'Daily Giveaway Winner',
                value: `**${summary.dailyWinner}** 🎉\nCongratulations! You were randomly selected from today's top performers!`,
                inline: false
            });
        }

        // Add weekly winner if present
        if (summary.weeklyWinner) {
            const weekNum = summary.dayNumber ? Math.floor(summary.dayNumber / 7) : '?';
            fields.push({
                name: 'WEEKLY GIVEAWAY WINNER',
                value: `**${summary.weeklyWinner}** 🎊\nCongratulations on winning Week ${weekNum}! You were selected from all top performers this week!`,
                inline: false
            });
        }

        // Add statistics
        fields.push(
            {
                name: 'Top GEXP Gainers',
                value: summary.topGexpGainers.slice(0, 5).map((p, i) => 
                    `${i + 1}. ${p.username}: ${this.formatNumber(p.gained)}`
                ).join('\n') || 'No data',
                inline: false
            },
            {
                name: 'Top Bedwars Winners',
                value: summary.topBedwarsWins.slice(0, 5).map((p, i) => 
                    `${i + 1}. ${p.username}: ${p.wins} wins`
                ).join('\n') || 'No data',
                inline: true
            },
            {
                name: 'Top SkyWars Winners',
                value: summary.topSkywarsWins.slice(0, 5).map((p, i) => 
                    `${i + 1}. ${p.username}: ${p.wins} wins`
                ).join('\n') || 'No data',
                inline: true
            },
            {
                name: 'Top Network Level Gains',
                value: summary.topNetworkLevelGain.slice(0, 5).map((p, i) => 
                    `${i + 1}. ${p.username}: +${p.gained}`
                ).join('\n') || 'No data',
                inline: false
            }
        );
        
        const embed = {
            title: title,
            description: `Event Period: ${this.eventConfig!.startDate} to ${this.eventConfig!.endDate}`,
            color: summary.weeklyWinner ? 0xFFD700 : (summary.dailyWinner ? 0x00FF00 : (isFinal ? 0xFF0000 : 0x3498DB)),
            fields: fields,
            timestamp: new Date().toISOString(),
            footer: {
                text: 'MiscManager Guild Event Tracker'
            }
        };

        try {
            await this.api.discord.sendEmbed(this.discordChannelId, embed);
        } catch (error) {
            this.api.log.error(`Failed to send Discord report: ${error}`);
        }
    }

    private formatNumber(num: number): string {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    private calculateNetworkLevel(exp: number): number {
        const EXP_NEEDED = [100000, 150000, 250000, 500000, 750000, 1000000, 1500000, 2000000, 2500000, 3000000];
        const REVERSE_PQ_PREFIX = -(100000 - 2500) / 2;
        const REVERSE_CONST = REVERSE_PQ_PREFIX + 100000;
        const GROWTH_DIVIDES_2 = 2500;

        let level = 1;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let need = 0;
            if (level >= EXP_NEEDED.length) {
                need = Math.floor(REVERSE_CONST + (level - EXP_NEEDED.length) * GROWTH_DIVIDES_2);
            } else {
                need = EXP_NEEDED[level - 1] || 100000;
            }

            if (exp < need) break;
            exp -= need;
            level++;
        }

        const divisor = level >= EXP_NEEDED.length 
            ? REVERSE_CONST + (level - EXP_NEEDED.length) * GROWTH_DIVIDES_2 
            : (EXP_NEEDED[level - 1] || 100000);
        
        return level + (exp / divisor);
    }

    private calculateWeeklyGexp(uuid: string, guild: HypixelGuild | null): number {
        if (!guild) return 0;

        const member = guild.members.find(m => m.uuid === uuid);
        if (!member || !member.expHistory) return 0;

        return Object.values(member.expHistory).reduce((sum, exp) => sum + exp, 0);
    }

    private calculateDailyGexp(uuid: string, guild: HypixelGuild | null): number {
        if (!guild) return 0;

        const member = guild.members.find(m => m.uuid === uuid);
        if (!member || !member.expHistory) return 0;

        const today = new Date().toISOString().split('T')[0];
        if (!today) return 0;
        return member.expHistory[today] || 0;
    }

    private async fetchGuildData(): Promise<HypixelGuild | null> {
        try {
            // Use cached bot UUID if available to avoid rate limiting
            if (!this.botUuidCache) {
                const botUsername = 'MiscManager'; // The bot's Minecraft username
                
                // Fetch bot's UUID from Mojang API
                const mojangResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${botUsername}`);
                if (!mojangResponse.ok) {
                    this.api.log.error(`Failed to fetch bot UUID: ${mojangResponse.status}`);
                    return null;
                }
                
                const mojangData = await mojangResponse.json();
                this.botUuidCache = mojangData.id; // Cache the UUID (already without dashes from Mojang)
                this.api.log.info(`Cached bot UUID: ${this.botUuidCache}`);
            }

            // Fetch guild using bot's UUID
            const apiKey = this.getNextApiKey();
            const response = await fetch(
                `https://api.hypixel.net/guild?key=${apiKey}&player=${this.botUuidCache}`
            );

            if (!response.ok) {
                this.api.log.error(`Guild API returned status ${response.status}`);
                return null;
            }

            const data = await response.json();
            if (!data || !data.guild) {
                this.api.log.error('No guild data in response');
                return null;
            }
            
            return data.guild;
        } catch (error) {
            this.api.log.error(`Failed to fetch guild data: ${error}`);
            return null;
        }
    }

    private async fetchHypixelPlayer(uuid: string): Promise<HypixelPlayer | null> {
        try {
            const apiKey = this.getNextApiKey();
            const response = await fetch(`https://api.hypixel.net/v2/player?uuid=${uuid}`, {
                headers: { 'API-Key': apiKey }
            });

            if (!response.ok) return null;

            const data = await response.json();
            return data.player;
        } catch (error) {
            return null;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private sendToChannel(context: ChatMessageContext, api: ExtensionAPI, message: string): void {
        if (context.channel === 'Officer') {
            api.chat.sendOfficerChat(message);
        } else if (context.channel === 'Guild') {
            api.chat.sendGuildChat(message);
        } else {
            api.chat.sendPrivateMessage(context.username, message);
        }
    }

    getChatPatterns(): ChatPattern[] {
        return [
            {
                id: 'start-event',
                extensionId: 'guild-event-tracker',
                pattern: /^!startevent\s+.+$/i,
                priority: 1,
                description: 'Start a guild event (GM/Leader only)',
                handler: this.handleStartEvent.bind(this)
            },
            {
                id: 'stop-event',
                extensionId: 'guild-event-tracker',
                pattern: /^!stopevent$/i,
                priority: 1,
                description: 'Stop current guild event (GM/Leader only)',
                handler: this.handleStopEvent.bind(this)
            },
            {
                id: 'daily-event-report',
                extensionId: 'guild-event-tracker',
                pattern: /^!dailyeventreport$/i,
                priority: 1,
                description: 'Generate daily event report (GM/Leader only)',
                handler: this.handleDailyReport.bind(this)
            },
            {
                id: 'save-event-data',
                extensionId: 'guild-event-tracker',
                pattern: /^!saveeventdata$/i,
                priority: 1,
                description: 'Manually save event data (GM/Leader only)',
                handler: this.handleSaveEventData.bind(this)
            },
            {
                id: 'event-status',
                extensionId: 'guild-event-tracker',
                pattern: /^!eventstatus$/i,
                priority: 1,
                description: 'Show current event status',
                handler: this.handleEventStatus.bind(this)
            },
            {
                id: 'pre-reboot-save',
                extensionId: 'guild-event-tracker',
                pattern: /^!saveandreboot\b/i,
                priority: 1,
                description: 'Save event data before bot reboot',
                handler: this.handlePreReboot.bind(this)
            }
        ];
    }

    async cleanup(): Promise<void> {
        this.api.log.info('Cleaning up Guild Event Tracker Extension...');
        
        // Clear timers
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        if (this.dailyReportTimer) {
            clearInterval(this.dailyReportTimer);
        }

        // Save event data if event is active
        if (this.eventConfig && this.eventConfig.active) {
            this.api.log.info('Saving event data before cleanup...');
            try {
                await this.updateAllMembers();
                await this.saveEventConfig();
                await this.saveGiveawayData();
                this.api.log.success('Event data saved successfully');
            } catch (error) {
                this.api.log.error(`Failed to save event data during cleanup: ${error}`);
            }
        }

        this.api.log.success('Guild Event Tracker Extension cleaned up');
    }
}

module.exports = GuildEventTrackerExtension;
