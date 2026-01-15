import { Bot } from 'mineflayer';
import Bridge from '../../../bridge';

interface BedwarsStats {
  fkdr: number;
  wins: number;
  finals: number;
  stars: number;
}

async function fetchBedwarsStats(username: string): Promise<BedwarsStats | null> {
  try {
    // Get UUID from username
    const mojangResponse = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
    if (!mojangResponse.ok) return null;
    
    const mojangData = await mojangResponse.json();
    const uuid = mojangData.id;

    // Get Hypixel stats
    const hypixelResponse = await fetch(
      `https://api.hypixel.net/v2/player?uuid=${uuid}`,
      {
        headers: {
          'API-Key': process.env.HYPIXEL_API_KEY || ''
        }
      }
    );

    if (!hypixelResponse.ok) return null;
    
    const hypixelData = await hypixelResponse.json();
    
    if (!hypixelData.success || !hypixelData.player) return null;

    const bw = hypixelData.player.stats?.Bedwars || {};
    
    // Calculate stats
    const finals = bw.final_kills_bedwars || 0;
    const deaths = bw.final_deaths_bedwars || 0;
    const fkdr = deaths > 0 ? parseFloat((finals / deaths).toFixed(2)) : finals;
    const wins = bw.wins_bedwars || 0;
    const stars = hypixelData.player.achievements?.bedwars_level || 0;

    return { fkdr, wins, finals, stars };
  } catch (error) {
    console.error('Error fetching Bedwars stats:', error);
    return null;
  }
}

export default {
  name: 'message',
  runOnce: false,
  run(bridge: Bridge, message: any) {
    const bot = (bridge.mineflayer as any).bot as Bot;
    if (!bot) return;

    const messageText = message.toString();

    // Check for !bw command in guild chat (handles rank tags like [MVP++], [Staff], etc.)
    const bwPattern = /Guild > (?:\[.+?\] )?(\w+)(?: \[.+?\])?: !bw (\w+)/;
    const match = messageText.match(bwPattern);

    if (match && match[2]) {
      const playerName = match[2];
      
      // Fetch stats asynchronously
      fetchBedwarsStats(playerName).then(stats => {
        if (!stats) {
          bot.chat(`/gc Could not find stats for ${playerName}`);
          return;
        }

        // Format the response
        const response = `${playerName}: ${stats.fkdr} FKDR | ${stats.wins.toLocaleString()} Wins | ${stats.finals.toLocaleString()} Finals | ${stats.stars}⭐`;
        
        bot.chat(`/gc ${response}`);
      }).catch(error => {
        console.error('Error in !bw command:', error);
        bot.chat(`/gc Error fetching stats for ${playerName}`);
      });
    }
  }
};
