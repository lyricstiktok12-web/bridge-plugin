/**
 * SkyBlock Slayers Handler
 */

import { Achievements, SkyBlock, StatsHandler } from '../../types';
import { getRandomHexColor } from '../../utils';

export const skyblockSlayersHandler: StatsHandler = {
    gameMode: 'SkyBlock Slayers',
    command: 'sb slayers',
    description: 'Check SkyBlock slayer stats',
    buildStatsMessage: (playerName: string, achievements?: Achievements, stats?: SkyBlock): string => {
        if (!stats || !stats.slayer_bosses) {
            return `No SkyBlock slayer data found for ${playerName}. Are they nicked? | ${getRandomHexColor()}`;
        }

        const slayers = stats.slayer_bosses;

        // Zombie Slayer
        const zombieXP = slayers.zombie?.xp ?? 0;
        const zombieLevel = getSlayerLevel(zombieXP);
        const zombieT4Kills = slayers.zombie?.kills_tier_3 ?? 0;
        const zombieT5Kills = slayers.zombie?.kills_tier_4 ?? 0;

        // Spider Slayer
        const spiderXP = slayers.spider?.xp ?? 0;
        const spiderLevel = getSlayerLevel(spiderXP);
        const spiderT4Kills = slayers.spider?.kills_tier_3 ?? 0;
        const spiderT5Kills = slayers.spider?.kills_tier_4 ?? 0;

        // Wolf Slayer
        const wolfXP = slayers.wolf?.xp ?? 0;
        const wolfLevel = getSlayerLevel(wolfXP);
        const wolfT4Kills = slayers.wolf?.kills_tier_3 ?? 0;
        const wolfT5Kills = slayers.wolf?.kills_tier_4 ?? 0;

        // Enderman Slayer
        const endermanXP = slayers.enderman?.xp ?? 0;
        const endermanLevel = getSlayerLevel(endermanXP);
        const endermanT4Kills = slayers.enderman?.kills_tier_3 ?? 0;
        const endermanT5Kills = slayers.enderman?.kills_tier_4 ?? 0;

        // Blaze Slayer
        const blazeXP = slayers.blaze?.xp ?? 0;
        const blazeLevel = getSlayerLevel(blazeXP);
        const blazeT4Kills = slayers.blaze?.kills_tier_3 ?? 0;
        const blazeT5Kills = slayers.blaze?.kills_tier_4 ?? 0;

        // Vampire Slayer
        const vampireXP = slayers.vampire?.xp ?? 0;
        const vampireLevel = getSlayerLevel(vampireXP);
        const vampireT4Kills = slayers.vampire?.kills_tier_3 ?? 0;
        const vampireT5Kills = slayers.vampire?.kills_tier_4 ?? 0;

        const totalSlayerXP = zombieXP + spiderXP + wolfXP + endermanXP + blazeXP + vampireXP;
        const totalSlayerLevel = zombieLevel + spiderLevel + wolfLevel + endermanLevel + blazeLevel + vampireLevel;

        return `${playerName} Slayers: ${totalSlayerXP.toLocaleString()} XP | Z${zombieLevel} S${spiderLevel} W${wolfLevel} E${endermanLevel} B${blazeLevel} V${vampireLevel} | ${getRandomHexColor()}`;
    }
};

/**
 * Calculate slayer level from XP
 */
function getSlayerLevel(xp: number): number {
    const slayerXP = [5, 15, 200, 1000, 5000, 20000, 100000, 400000, 1000000];
    let level = 0;
    
    for (let i = 0; i < slayerXP.length; i++) {
        if (xp >= slayerXP[i]) {
            level = i + 1;
        } else {
            break;
        }
    }
    
    return level;
}
