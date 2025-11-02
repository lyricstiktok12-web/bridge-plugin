/**
 * Export all game mode handlers
 */

export { bedwarsHandler } from './bedwars';
export { skywarsHandler } from './skywars';
export { duelsHandler, uhcDuelsHandler, swDuelsHandler, classicDuelsHandler, bowDuelsHandler, opDuelsHandler, comboDuelsHandler, potionDuelsHandler } from './duels';
export { uhcHandler } from './uhc';
export { buildBattleHandler } from './buildbattle';
export { murderMysteryHandler } from './murdermystery';
export { tntGamesHandler } from './tntgames';
export { megaWallsHandler } from './megawalls';
export { arcadeHandler } from './arcade';
export { copsAndCrimsHandler } from './copsandcrims';

// Export all SkyBlock handlers
export { allSkyblockHandlers } from './skyblock/index';

import { bedwarsHandler } from './bedwars';
import { skywarsHandler } from './skywars';
import { duelsHandler, uhcDuelsHandler, swDuelsHandler, classicDuelsHandler, bowDuelsHandler, opDuelsHandler, comboDuelsHandler, potionDuelsHandler } from './duels';
import { uhcHandler } from './uhc';
import { buildBattleHandler } from './buildbattle';
import { murderMysteryHandler } from './murdermystery';
import { tntGamesHandler } from './tntgames';
import { megaWallsHandler } from './megawalls';
import { arcadeHandler } from './arcade';
import { copsAndCrimsHandler } from './copsandcrims';
import { allSkyblockHandlers } from './skyblock/index';

export const allHandlers = [
    bedwarsHandler,
    skywarsHandler,
    duelsHandler,
    uhcDuelsHandler,
    swDuelsHandler,
    classicDuelsHandler,
    bowDuelsHandler,
    opDuelsHandler,
    comboDuelsHandler,
    potionDuelsHandler,
    uhcHandler,
    buildBattleHandler,
    murderMysteryHandler,
    tntGamesHandler,
    megaWallsHandler,
    arcadeHandler,
    copsAndCrimsHandler,
    ...allSkyblockHandlers
];
