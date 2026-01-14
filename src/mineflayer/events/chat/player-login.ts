import { Bot } from 'mineflayer';

const greetingCooldowns = new Map<string, number>();
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutes cooldown per player

const greetings = [
  'Welcome back, {player}! 👋',
  'Hey {player}, good to see you! ✨',
  '{player} is here! 🎉',
  'Yo {player}! Welcome back!',
  'Look who\'s back! Hey {player}! 🌟'
];

function getRandomGreeting(playerName: string): string {
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  return greeting.replace('{player}', playerName);
}

function canGreet(playerName: string): boolean {
  const now = Date.now();
  const lastGreeting = greetingCooldowns.get(playerName);
  
  if (!lastGreeting || now - lastGreeting > COOLDOWN_TIME) {
    greetingCooldowns.set(playerName, now);
    return true;
  }
  
  return false;
}

export function handlePlayerLogin(bot: Bot) {
  bot.on('message', (message) => {
    const messageText = message.toString();
    
    // Pattern for when a guild member logs into Hypixel
    // Usually shows as "Guild > PlayerName joined."
    const loginPattern = /Guild > (\w+) joined\./;
    const match = messageText.match(loginPattern);
    
    if (match) {
      const playerName = match[1];
      const botUsername = bot.username;
      
      // Don't greet ourselves
      if (playerName === botUsername) return;
      
      // Check cooldown
      if (canGreet(playerName)) {
        const greeting = getRandomGreeting(playerName);
        
        // Send to guild chat
        setTimeout(() => {
          bot.chat(`/gc ${greeting}`);
        }, 500); // Small delay to avoid rate limiting
      }
    }
  });
}
