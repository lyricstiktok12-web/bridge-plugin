/**
 * SkyBlock Collections Handler
 */

import { Achievements, SkyBlock, StatsHandler } from '../../types';
import { getRandomHexColor } from '../../utils';

export const skyblockCollectionsHandler: StatsHandler = {
    gameMode: 'SkyBlock Collections',
    command: 'sb collections',
    description: 'Check SkyBlock collections',
    buildStatsMessage: (playerName: string, achievements?: Achievements, stats?: SkyBlock): string => {
        if (!stats) {
            return `No SkyBlock collection data found for ${playerName}. Are they nicked? | ${getRandomHexColor()}`;
        }

        // Farming collections
        const wheat = stats.collection_wheat ?? 0;
        const carrot = stats.collection_carrot ?? 0;
        const potato = stats.collection_potato ?? 0;
        const pumpkin = stats.collection_pumpkin ?? 0;
        const melon = stats.collection_melon ?? 0;
        const cocoa = stats.collection_cocoa ?? 0;
        const cactus = stats.collection_cactus ?? 0;
        const sugarCane = stats.collection_sugar_cane ?? 0;
        const netherWart = stats.collection_nether_wart ?? 0;

        // Mining collections
        const cobblestone = stats.collection_cobblestone ?? 0;
        const iron = stats.collection_iron_ingot ?? 0;
        const gold = stats.collection_gold_ingot ?? 0;
        const diamond = stats.collection_diamond ?? 0;
        const lapis = stats.collection_lapis_lazuli ?? 0;
        const emerald = stats.collection_emerald ?? 0;
        const redstone = stats.collection_redstone ?? 0;
        const coal = stats.collection_coal ?? 0;
        const obsidian = stats.collection_obsidian ?? 0;

        // Combat collections
        const rottenFlesh = stats.collection_rotten_flesh ?? 0;
        const bone = stats.collection_bone ?? 0;
        const string = stats.collection_string ?? 0;
        const spiderEye = stats.collection_spider_eye ?? 0;
        const gunpowder = stats.collection_gunpowder ?? 0;
        const enderPearl = stats.collection_ender_pearl ?? 0;
        const blazeRod = stats.collection_blaze_rod ?? 0;

        // Foraging collections
        const oakLog = stats.collection_log ?? 0;
        const spruceLog = stats.collection_log_spruce ?? 0;
        const birchLog = stats.collection_log_birch ?? 0;
        const jungleLog = stats.collection_log_jungle ?? 0;
        const acaciaLog = stats.collection_log_acacia ?? 0;
        const darkOakLog = stats.collection_log_dark_oak ?? 0;

        // Fishing collections
        const rawFish = stats.collection_raw_fish ?? 0;
        const rawSalmon = stats.collection_raw_salmon ?? 0;
        const clownfish = stats.collection_clownfish ?? 0;
        const pufferfish = stats.collection_pufferfish ?? 0;
        const prismarineShard = stats.collection_prismarine_shard ?? 0;
        const inkSack = stats.collection_ink_sack ?? 0;

        // Format numbers
        const formatNumber = (num: number): string => {
            if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
            if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
            return num.toLocaleString();
        };

        // Find top 3 collections overall
        const allCollections = [
            { name: 'Wheat', value: wheat },
            { name: 'Cobble', value: cobblestone },
            { name: 'Iron', value: iron },
            { name: 'Oak Log', value: oakLog },
            { name: 'Raw Fish', value: rawFish },
            { name: 'Rotten Flesh', value: rottenFlesh },
            { name: 'Coal', value: coal },
            { name: 'Diamond', value: diamond },
            { name: 'Ender Pearl', value: enderPearl }
        ].sort((a, b) => b.value - a.value).slice(0, 3);

        return `${playerName} Collections: ${allCollections.map(c => `${c.name} ${formatNumber(c.value)}`).join(', ')} ${getRandomHexColor()}`;
    }
};
