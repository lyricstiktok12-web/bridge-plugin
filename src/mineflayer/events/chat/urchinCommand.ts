import { Bot } from 'mineflayer';
import Bridge from '../../../bridge';

interface CachedUUID {
  uuid: string;
  timestamp: number;
}

interface CachedLookup {
  tags: any[];
  timestamp: number;
}

interface Stats {
  totalLookups: number;
  cachedLookups: number;
  taggedPlayers: number;
  mostCheckedPlayers: Map<string, number>;
}

// Caching and stats (persists across message events)
const uuidCache = new Map<string, CachedUUID>();
const lookupCache = new Map<string, CachedLookup>();
const commandCooldowns = new Map<string, Map<string, number>>();
const processingRequests = new Set<string>();

const stats: Stats = {
  totalLookups: 0,
  cachedLookups: 0,
  taggedPlayers: 0,
  mostCheckedPlayers: new Map(),
};

// Configuration
const config = {
  urchinApiKey: process.env.URCHIN_API_KEY || '',
  cooldownTime: parseInt(process.env.COOLDOWN_URCHIN || '5') * 1000,
  uuidCacheDuration: 60 * 60 * 1000, // 1 hour
  lookupCacheDuration: 5 * 60 * 1000, // 5 minutes
  maxBatchSize: 5,
};

// Cleanup interval for caches
let cleanupInterval: NodeJS.Timeout | null = null;
if (!cleanupInterval) {
  cleanupInterval = setInterval(() => {
    const now = Date.now();

    // Clean up cooldowns
    for (const [command, cooldowns] of commandCooldowns.entries()) {
      for (const [playerName, timestamp] of cooldowns.entries()) {
        if (now - timestamp > config.cooldownTime * 2) {
          cooldowns.delete(playerName);
        }
      }
    }

    // Clean up UUID cache
    for (const [username, cached] of uuidCache.entries()) {
      if (now - cached.timestamp > config.uuidCacheDuration) {
        uuidCache.delete(username);
      }
    }

    // Clean up lookup cache
    for (const [username, cached] of lookupCache.entries()) {
      if (now - cached.timestamp > config.lookupCacheDuration) {
        lookupCache.delete(username);
      }
    }
  }, 5 * 60 * 1000);
}

async function getUUID(username: string): Promise<string> {
  const lowerUsername = username.toLowerCase();

  // Check cache first
  const cached = uuidCache.get(lowerUsername);
  if (cached && Date.now() - cached.timestamp < config.uuidCacheDuration) {
    return cached.uuid;
  }

  // Fetch from Mojang API
  const response = await fetch(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    {
      headers: {
        'User-Agent': 'MiscellaneousBridge/2.6',
        Accept: 'application/json',
      },
    }
  );

  if (response.status === 204 || response.status === 404) {
    throw new Error(`NOT_FOUND`);
  }

  if (!response.ok) {
    throw new Error(`API_ERROR`);
  }

  const data: any = await response.json();
  const uuid = data.id;

  // Cache the UUID
  uuidCache.set(lowerUsername, { uuid, timestamp: Date.now() });

  return uuid;
}

async function lookupPlayer(username: string): Promise<{
  success: boolean;
  message: string;
  tags?: any[];
  fromCache?: boolean;
}> {
  const lowerUsername = username.toLowerCase();

  // Check lookup cache first
  const cachedLookup = lookupCache.get(lowerUsername);
  if (cachedLookup && Date.now() - cachedLookup.timestamp < config.lookupCacheDuration) {
    if (cachedLookup.tags.length === 0) {
      return {
        success: true,
        message: `[NOT-TAGGED] ${username} has no blacklist tags.`,
        tags: [],
        fromCache: true,
      };
    }

    const tagTypes = cachedLookup.tags.map(t => t.type.toUpperCase().replace(/ /g, '-')).join(', ');
    const tagCount = cachedLookup.tags.length;
    const firstReason = cachedLookup.tags[0]?.reason || 'No reason given';

    return {
      success: true,
      message: `[${tagTypes}] ${username} - ${tagCount} tag${tagCount > 1 ? 's' : ''}: ${firstReason}${tagCount > 1 ? ` (+${tagCount - 1} more)` : ''}`,
      tags: cachedLookup.tags,
      fromCache: true,
    };
  }

  // Get UUID
  let uuid: string;
  try {
    uuid = await getUUID(username);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return {
        success: false,
        message: `[NOT-FOUND] ${username} is not a valid Minecraft username.`,
      };
    }
    return {
      success: false,
      message: `[ERROR] Failed to lookup ${username}. Try again later.`,
    };
  }

  // Query Urchin API
  try {
    const urchinUrl = `https://urchin.ws/player/${uuid}?key=${config.urchinApiKey}&sources=GAME,MANUAL,CHAT,ME,PARTY`;

    const urchinResponse = await fetch(urchinUrl, {
      headers: {
        'User-Agent': 'MiscellaneousBridge/2.6',
        Accept: 'application/json',
      },
    });

    if (urchinResponse.status === 404) {
      // Cache the "not found" result
      lookupCache.set(lowerUsername, { tags: [], timestamp: Date.now() });

      return {
        success: true,
        message: `[NOT-TAGGED] ${username} has no blacklist tags.`,
        tags: [],
        fromCache: false,
      };
    }

    if (urchinResponse.status === 401) {
      return {
        success: false,
        message: '[ERROR] API authentication failed. Contact an admin.',
      };
    }

    if (urchinResponse.status === 429) {
      return {
        success: false,
        message: '[ERROR] Rate limit hit. Please try again in a moment.',
      };
    }

    if (!urchinResponse.ok) {
      throw new Error(`Urchin API error: ${urchinResponse.status}`);
    }

    const urchinData: any = await urchinResponse.json();
    const tags = urchinData.tags || [];

    // Cache the result
    lookupCache.set(lowerUsername, { tags, timestamp: Date.now() });

    if (tags.length === 0) {
      return {
        success: true,
        message: `[NOT-TAGGED] ${username} has no blacklist tags.`,
        tags: [],
        fromCache: false,
      };
    }

    // Combine all tags into one message
    const tagTypes = tags.map((t: any) => t.type.toUpperCase().replace(/ /g, '-')).join(', ');
    const tagCount = tags.length;
    const firstReason = tags[0]?.reason || 'No reason given';

    return {
      success: true,
      message: `[${tagTypes}] ${username} - ${tagCount} tag${tagCount > 1 ? 's' : ''}: ${firstReason}${tagCount > 1 ? ` (+${tagCount - 1} more)` : ''}`,
      tags,
      fromCache: false,
    };
  } catch (error) {
    console.error(`Error querying Urchin API for ${username}:`, error);
    return {
      success: false,
      message: `[ERROR] Failed to check ${username}. Try again later.`,
    };
  }
}

function checkCooldown(command: string, playerName: string, bot: Bot): boolean {
  if (!commandCooldowns.has(command)) {
    commandCooldowns.set(command, new Map());
  }

  const commandCooldown = commandCooldowns.get(command)!;
  const lastRequest = commandCooldown.get(playerName);
  const now = Date.now();

  if (lastRequest) {
    const timeDiff = now - lastRequest;
    if (timeDiff < config.cooldownTime) {
      const remaining = Math.ceil((config.cooldownTime - timeDiff) / 1000);
      bot.chat(`/gc ${playerName}, please wait ${remaining}s before using !${command} again.`);
      return false;
    }
  }

  return true;
}

function setCooldown(command: string, playerName: string, timestamp: number): void {
  if (!commandCooldowns.has(command)) {
    commandCooldowns.set(command, new Map());
  }
  commandCooldowns.get(command)!.set(playerName, timestamp);
}

export default {
  name: 'message',
  runOnce: false,
  run(bridge: Bridge, message: any) {
    const bot = (bridge.mineflayer as any).bot as Bot;
    if (!bot) return;

    const messageText = message.toString();

    // !view command - matches: Guild > [MVP++] username [Staff]: !view target
    const viewPattern = /Guild > (?:\[.+?\] )?(\w+)(?: \[.+?\])?: !view(?:\s+(\w+))?$/i;
    const viewMatch = messageText.match(viewPattern);

    if (viewMatch) {
      const requester = viewMatch[1];
      const target = viewMatch[2] || requester;

      if (!config.urchinApiKey) {
        bot.chat('/gc [ERROR] Urchin API key not configured.');
        return;
      }

      if (!checkCooldown('view', requester, bot)) return;

      const requestKey = `${requester}-${target}-view`;
      if (processingRequests.has(requestKey)) return;

      processingRequests.add(requestKey);
      setCooldown('view', requester, Date.now());

      lookupPlayer(target)
        .then(result => {
          // Update stats
          stats.totalLookups++;
          if (result.fromCache) stats.cachedLookups++;
          if (result.tags && result.tags.length > 0) stats.taggedPlayers++;

          const checkCount = stats.mostCheckedPlayers.get(target.toLowerCase()) || 0;
          stats.mostCheckedPlayers.set(target.toLowerCase(), checkCount + 1);

          bot.chat(`/gc ${result.message}`);
        })
        .catch(error => {
          console.error('Error in !view command:', error);
          bot.chat(`/gc [ERROR] Something went wrong. Please try again later.`);
        })
        .finally(() => {
          processingRequests.delete(requestKey);
        });

      return;
    }

    // !viewmulti command - matches: Guild > username: !viewmulti player1 player2 player3
    const viewMultiPattern = /Guild > (?:\[.+?\] )?(\w+)(?: \[.+?\])?: !viewmulti\s+(.+)$/i;
    const viewMultiMatch = messageText.match(viewMultiPattern);

    if (viewMultiMatch) {
      const requester = viewMultiMatch[1];
      const playersInput = viewMultiMatch[2];

      if (!config.urchinApiKey) {
        bot.chat('/gc [ERROR] Urchin API key not configured.');
        return;
      }

      if (!checkCooldown('viewmulti', requester, bot)) return;

      const players = playersInput.split(/\s+/).slice(0, config.maxBatchSize);

      if (players.length === 0) {
        bot.chat('/gc Please specify at least one player to check.');
        return;
      }

      setCooldown('viewmulti', requester, Date.now());
      bot.chat(`/gc Checking ${players.length} player(s)...`);

      (async () => {
        for (const player of players) {
          try {
            const result = await lookupPlayer(player);

            // Update stats
            stats.totalLookups++;
            if (result.fromCache) stats.cachedLookups++;
            if (result.tags && result.tags.length > 0) stats.taggedPlayers++;

            const checkCount = stats.mostCheckedPlayers.get(player.toLowerCase()) || 0;
            stats.mostCheckedPlayers.set(player.toLowerCase(), checkCount + 1);

            bot.chat(`/gc ${result.message}`);

            // Small delay between checks
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Error checking ${player}:`, error);
            bot.chat(`/gc [ERROR] Failed to check ${player}`);
          }
        }
      })();

      return;
    }

    // !urchinstats command
    const statsPattern = /Guild > (?:\[.+?\] )?(\w+)(?: \[.+?\])?: !urchinstats$/i;
    const statsMatch = messageText.match(statsPattern);

    if (statsMatch) {
      const cacheHitRate =
        stats.totalLookups > 0
          ? ((stats.cachedLookups / stats.totalLookups) * 100).toFixed(1)
          : '0.0';

      const topChecked = Array.from(stats.mostCheckedPlayers.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([player, count]) => `${player} (${count})`)
        .join(', ') || 'None';

      const statsMessage = `[URCHIN STATS] Lookups: ${stats.totalLookups} | Cache Hit Rate: ${cacheHitRate}% | Tagged Found: ${stats.taggedPlayers} | Top Checked: ${topChecked}`;

      bot.chat(`/gc ${statsMessage}`);
    }
  },
};
