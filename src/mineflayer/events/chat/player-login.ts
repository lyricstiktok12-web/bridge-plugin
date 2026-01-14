import { Bot } from 'mineflayer';
import Bridge from '../../../bridge';

const greetingCooldowns = new Map<string, number>();
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutes cooldown per player

const greetings: string[] = [
  'Welcome back, {player}! 👋',
  'Hey {player}, good to see you! ✨',
  '{player} is here! 🎉',
  'Yo {player}! Welcome back!',
  'Look who\'s back! Hey {player}! 🌟'
];

function getRandomGreeting(playerName: string): string {
  const randomIndex = Math.floor(Math.random() * greetings.length);
  const greeting = greetings[randomIndex];
  if (!greeting) return `Welcome back, ${playerName}!`;
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

export default {
  name: 'message',
  runOnce: false,
  run(bridge: Bridge, message: any) {
    const bot = (bridge.mineflayer as any).bot as Bot;
    if (!bot) return;
    
    const messageText = message.toString();
    
    const loginPattern = /Guild > (\w+) joined\./;
    const match = messageText.match(loginPattern);
    
    if (match && match[1]) {
      const playerName = match[1];
      const botUsername = bot.username || '';
      
      if (playerName === botUsername) return;
      
      if (canGreet(playerName)) {
        const greeting = getRandomGreeting(playerName);
        
        setTimeout(() => {
          bot.chat(`/gc ${greeting}`);
        }, 500);
      }
    }
  }
};
