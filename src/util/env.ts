import consola from 'consola';
import { config } from 'dotenv';
import { z } from 'zod';

const BOOLEAN_SCHEMA = z
    .string()
    .toLowerCase()
    .transform((x) => x === 'true')
    .pipe(z.boolean());

const OPTIONAL_BOOLEAN_SCHEMA = z
    .string()
    .toLowerCase()
    .transform((x) => x === 'true')
    .pipe(z.boolean())
    .optional();

const SNOWFLAKE_SCHEMA = z.coerce.string().regex(/^\d*$/gm);

const OPTIONAL_STRING_SCHEMA = z.string().optional();

const OPTIONAL_NUMBER_SCHEMA = z.coerce.number().optional();

// * By default, dotenv populates missing values with empty strings - minimum length should not be used for optional fields
const envSchema = z
    .object({
        // === CORE CONFIGURATION ===
        MINECRAFT_EMAIL: z.string().email(),
        MINECRAFT_PASSWORD: OPTIONAL_STRING_SCHEMA,
        HYPIXEL_API_KEY: z.string(),
        HYPIXEL_GUILD_NAME: z.string(),
        MINECRAFT_CHAT_SEPARATOR: z.string().trim().min(1),
        USE_PROFANITY_FILTER: BOOLEAN_SCHEMA,
        USE_FIRST_WORD_OF_AUTHOR_NAME: BOOLEAN_SCHEMA,
        MINIMUM_NETWORK_LEVEL: z.coerce.number().min(0).default(0),
        REMINDER_ENABLED: BOOLEAN_SCHEMA,
        REMINDER_MESSAGE: z.string().max(256),
        REMINDER_FREQUENCY: z.coerce.number().int().positive().default(60),
        MINECRAFT_RECONNECT_DELAY: z.coerce.number().int().positive().default(10),
        
        // === DISCORD CONFIGURATION ===
        DISCORD_TOKEN: z.string().min(1),
        DISCORD_IGNORE_PREFIX: z.string().trim().min(1),
        DISCORD_INVITE_LINK: z.string().startsWith('discord.gg/'),
        DISCORD_SERVER_ID: SNOWFLAKE_SCHEMA,
        MEMBER_CHANNEL_ID: SNOWFLAKE_SCHEMA,
        OFFICER_CHANNEL_ID: SNOWFLAKE_SCHEMA,
        BLACKLIST_CHANNEL_ID: SNOWFLAKE_SCHEMA,
        BOT_OWNER_ID: SNOWFLAKE_SCHEMA,
        STAFF_ROLE_ID: SNOWFLAKE_SCHEMA,

        // === PLUGIN SYSTEM CONFIGURATION ===
        PLUGIN_AUTO_RESTART_ENABLED: OPTIONAL_BOOLEAN_SCHEMA,
        PLUGIN_GUILD_STATS_ENABLED: OPTIONAL_BOOLEAN_SCHEMA,
        PLUGIN_CUSTOM_COMMANDS_ENABLED: OPTIONAL_BOOLEAN_SCHEMA,
        PLUGIN_MEMBER_VERIFICATION_ENABLED: OPTIONAL_BOOLEAN_SCHEMA,
        PLUGIN_EVENT_SCHEDULER_ENABLED: OPTIONAL_BOOLEAN_SCHEMA,

        // === AUTO-RESTART PLUGIN ===
        AUTO_RESTART_SCHEDULES: OPTIONAL_STRING_SCHEMA,
        AUTO_RESTART_WARNING_TIME: OPTIONAL_NUMBER_SCHEMA,
        AUTO_RESTART_ANNOUNCE: OPTIONAL_BOOLEAN_SCHEMA,
        AUTO_RESTART_MESSAGE: OPTIONAL_STRING_SCHEMA,

        // === GUILD STATS PLUGIN ===
        GUILD_STATS_UPDATE_INTERVAL: OPTIONAL_NUMBER_SCHEMA,
        GUILD_STATS_LEADERBOARD_SIZE: OPTIONAL_NUMBER_SCHEMA,
        GUILD_STATS_TRACK_LEVEL: OPTIONAL_BOOLEAN_SCHEMA,
        GUILD_STATS_TRACK_GEXP: OPTIONAL_BOOLEAN_SCHEMA,
        GUILD_STATS_DATA_FILE: OPTIONAL_STRING_SCHEMA,
        GUILD_STATS_CACHE_EXPIRY: OPTIONAL_NUMBER_SCHEMA,

        // === CUSTOM COMMANDS PLUGIN ===
        CUSTOM_COMMANDS_MAX_PER_USER: OPTIONAL_NUMBER_SCHEMA,
        CUSTOM_COMMANDS_COOLDOWN: OPTIONAL_NUMBER_SCHEMA,
        CUSTOM_COMMANDS_PREFIX: OPTIONAL_STRING_SCHEMA,
        CUSTOM_COMMANDS_ENABLE_ALIASES: OPTIONAL_BOOLEAN_SCHEMA,
        CUSTOM_COMMANDS_STORAGE_FILE: OPTIONAL_STRING_SCHEMA,

        // === MEMBER VERIFICATION PLUGIN ===
        MEMBER_VERIFICATION_REQUIRE_MINECRAFT: OPTIONAL_BOOLEAN_SCHEMA,
        MEMBER_VERIFICATION_AUTO_ASSIGN_ROLE: OPTIONAL_STRING_SCHEMA,
        MEMBER_VERIFICATION_CHANNEL: OPTIONAL_STRING_SCHEMA,
        MEMBER_VERIFICATION_WELCOME_MESSAGE: OPTIONAL_STRING_SCHEMA,

        // === EVENT SCHEDULER PLUGIN ===
        EVENT_SCHEDULER_ALLOW_USER_EVENTS: OPTIONAL_BOOLEAN_SCHEMA,
        EVENT_SCHEDULER_MAX_EVENTS_PER_USER: OPTIONAL_NUMBER_SCHEMA,
        EVENT_SCHEDULER_TIMEZONE: OPTIONAL_STRING_SCHEMA,
        EVENT_SCHEDULER_REMINDER_INTERVALS: OPTIONAL_STRING_SCHEMA,

        // === GENERAL PLUGIN SETTINGS ===
        PLUGINS_CONFIG_FILE: OPTIONAL_STRING_SCHEMA,
        PLUGINS_DIRECTORY: OPTIONAL_STRING_SCHEMA,
        PLUGINS_ENABLE_HOT_RELOAD: OPTIONAL_BOOLEAN_SCHEMA,
        PLUGINS_LOG_LEVEL: OPTIONAL_STRING_SCHEMA,

        // === BRIDGE API CONFIGURATION ===
        ENABLE_API: OPTIONAL_BOOLEAN_SCHEMA,
        API_PORT: z.coerce.number().int().positive().default(3000),
        ENABLE_AUTH: OPTIONAL_BOOLEAN_SCHEMA,
        JWT_SECRET: OPTIONAL_STRING_SCHEMA,
        ALLOWED_ORIGINS: OPTIONAL_STRING_SCHEMA,
        RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
        RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
        
        // === API AUTHENTICATION ===
        ADMIN_USERNAME: OPTIONAL_STRING_SCHEMA,
        ADMIN_PASSWORD: OPTIONAL_STRING_SCHEMA,
        API_KEY: OPTIONAL_STRING_SCHEMA,

        // === ADDITIONAL CONFIGURATION ===
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    })
    .refine((data) => !data.REMINDER_ENABLED || data.REMINDER_MESSAGE.trim() !== '', {
        message: 'Reminders are enabled but a message has not been set',
        path: ['REMINDER_MESSAGE'],
    })
    .refine((data) => !data.ENABLE_API || !data.ENABLE_AUTH || (data.JWT_SECRET && data.JWT_SECRET.trim() !== ''), {
        message: 'API authentication is enabled but JWT_SECRET is not set',
        path: ['JWT_SECRET'],
    })
    .refine((data) => !data.ENABLE_API || !data.ENABLE_AUTH || (data.ADMIN_PASSWORD && data.ADMIN_PASSWORD.trim() !== '') || (data.API_KEY && data.API_KEY.trim() !== ''), {
        message: 'API authentication is enabled but neither ADMIN_PASSWORD nor API_KEY is set',
        path: ['ADMIN_PASSWORD', 'API_KEY'],
    });

config();
const env = envSchema.safeParse(process.env);

if (!env.success) {
    consola.error('Invalid configuration:', env.error.format());
    process.exit(1);
}

export default env.data!