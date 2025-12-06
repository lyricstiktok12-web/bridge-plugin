/**
 * SkyBlock Overview Handler
 */

import { Achievements, SkyBlock, StatsHandler } from '../../types';
import { getRandomHexColor } from '../../utils';

export const skyblockOverviewHandler: StatsHandler = {
    gameMode: 'SkyBlock',
    command: 'sb',
    description: 'Check SkyBlock overview',
    buildStatsMessage: (playerName: string, achievements?: Achievements, stats?: SkyBlock): string => {
        if (!stats || Object.keys(stats).length === 0) {
            return `No SkyBlock stats found for ${playerName}. Are they nicked? | ${getRandomHexColor()}`;
        }

        // Skills - from leveling.experience or player_data.experience  
        const skillData = (stats as any).leveling?.experience || {};
        const farmingLevel = skillData.SKILL_FARMING ? calculateSkillLevel(skillData.SKILL_FARMING) : 0;
        const miningLevel = skillData.SKILL_MINING ? calculateSkillLevel(skillData.SKILL_MINING) : 0;
        const combatLevel = skillData.SKILL_COMBAT ? calculateSkillLevel(skillData.SKILL_COMBAT) : 0;
        const foragingLevel = skillData.SKILL_FORAGING ? calculateSkillLevel(skillData.SKILL_FORAGING) : 0;
        const fishingLevel = skillData.SKILL_FISHING ? calculateSkillLevel(skillData.SKILL_FISHING) : 0;
        const enchantingLevel = skillData.SKILL_ENCHANTING ? calculateSkillLevel(skillData.SKILL_ENCHANTING) : 0;
        const alchemyLevel = skillData.SKILL_ALCHEMY ? calculateSkillLevel(skillData.SKILL_ALCHEMY) : 0;
        const tamingLevel = skillData.SKILL_TAMING ? calculateSkillLevel(skillData.SKILL_TAMING) : 0;

        // Calculate average skill level
        const skillLevels = [farmingLevel, miningLevel, combatLevel, foragingLevel, fishingLevel, enchantingLevel, alchemyLevel, tamingLevel];
        const totalSkillLevels = skillLevels.reduce((sum, level) => sum + level, 0);
        const averageSkillLevel = totalSkillLevels / skillLevels.length;

        // Slayer totals - from slayer.slayer_bosses
        const slayerData = (stats as any).slayer?.slayer_bosses || {};
        const zombieSlayerXP = slayerData.zombie?.xp ?? 0;
        const spiderSlayerXP = slayerData.spider?.xp ?? 0;
        const wolfSlayerXP = slayerData.wolf?.xp ?? 0;
        const endermanSlayerXP = slayerData.enderman?.xp ?? 0;
        const blazeSlayerXP = slayerData.blaze?.xp ?? 0;
        const totalSlayerXP = zombieSlayerXP + spiderSlayerXP + wolfSlayerXP + endermanSlayerXP + blazeSlayerXP;

        // Purse coins - from currencies.coin_purse
        const purseCoins = (stats as any).currencies?.coin_purse ?? 0;

        // SkyBlock level - from leveling.experience
        const skyblockXP = (stats as any).leveling?.experience ?? 0;
        const skyblockLevel = calculateSkyBlockLevel(skyblockXP);

        // Current profile name - this would ideally come from the profile data
        // For now, we'll try to extract it if it's available in the metadata
        const currentProfile = (stats as any).profile_name || (stats as any).cute_name || 'Profile';

        // Jacob's contest medals - from jacobs_contest.medals_inv
        const jacobsData = (stats as any).jacobs_contest?.medals_inv || {};
        const goldMedals = jacobsData.gold ?? 0;
        const silverMedals = jacobsData.silver ?? 0;
        const bronzeMedals = jacobsData.bronze ?? 0;

        return `[SB Overview] P: ${playerName} | LVL: ${skyblockLevel} | Skills: ${averageSkillLevel.toFixed(1)} | Purse: ${purseCoins.toLocaleString(3)} | ${getRandomHexColor()}`;
    }
};

/**
 * Calculate SkyBlock level from experience points
 * SkyBlock level formula: 100 XP per level
 */
function calculateSkyBlockLevel(xp: number): number {
    // Simple calculation: 100 XP per level
    return Math.floor(xp / 100);
}

/**
 * Calculate skill level from experience points using SkyBlock skill XP table
 */
function calculateSkillLevel(xp: number): number {
    // SkyBlock skill XP requirements (cumulative XP needed for each level)
    const skillXPTable = [
        0, 50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925,
        14925, 22425, 32425, 47425, 67425, 97425, 147425, 222425, 322425, 522425,
        822425, 1222425, 1722425, 2322425, 3022425, 3822425, 4722425, 5722425, 6822425, 8022425,
        9322425, 10722425, 13822425, 15522425, 17322425, 19222425, 21222425, 23322425, 25522425,
        27822425, 30222425, 32722425, 35322425, 38072425, 40972425, 44072425, 47472425, 51172425, 55172425,
        59472425, 64072425, 68972425, 74172425, 79672425, 85472425, 91572425, 97972425, 104672425, 111672425
    ];

    for (let i = skillXPTable.length - 1; i >= 0; i--) {
        if (xp >= skillXPTable[i]) {
            return i;
        }
    }
    return 0;
}

/**
 * Calculate dungeon level from experience points using Dungeon XP table
 */
function calculateDungeonLevel(xp: number): number {
    // Dungeon XP requirements (cumulative XP needed for each level)
    const dungeonXPTable = [
        0, 50, 125, 235, 395, 625, 955, 1425, 2095, 3045, 4385,
        6275, 8940, 12700, 17960, 25340, 35640, 50040, 70040, 97640, 135640,
        188140, 259640, 356640, 488640, 668640, 911640, 1239640, 1684640, 2284640, 3084640,
        4149640, 5559640, 7459640, 9959640, 13259640, 17559640, 23159640, 30359640, 39559640, 51559640,
        66559640, 85559640, 109559640, 139559640, 177559640, 225559640, 285559640, 360559640, 453559640, 569809640
    ];

    for (let i = dungeonXPTable.length - 1; i >= 0; i--) {
        if (xp >= dungeonXPTable[i]) {
            return i;
        }
    }
    return 0;
}
