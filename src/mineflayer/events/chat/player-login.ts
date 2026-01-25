import { Bot } from 'mineflayer';
import Bridge from '../../../bridge';

const greetings: string[] = [
  'Welcome back, {player}!',
  '{player} just logged in, welcome!',
  'Hello {player}!',
  '{player} has entered the chat!',
  'Good to see you, {player}!',
  'How are you {player}!',
  'Hey {player}!',
  '{player} is back!',
  'Welcome, {player}!',
  'Hi {player}!',
  '{player} joined!',
  'Greetings {player}!'
];

// Track last greeting per player
const lastPlayerGreetings = new Map<string, string>();

// Track last greeting time per player (for non-guild masters)
const lastGreetingTime = new Map<string, number>();

function getRandomGreeting(playerName: string): string {
  let greeting: string;
  let attempts = 0;
  const maxAttempts = 20;
  
  const lastGreeting = lastPlayerGreetings.get(playerName);
  
  // Keep trying until we get a different message than the last one for this player
  do {
    const randomIndex = Math.floor(Math.random() * greetings.length);
    const template = greetings[randomIndex];
    if (!template) {
      greeting = `Welcome back, ${playerName}!`;
    } else {
      greeting = template.replace('{player}', playerName);
    }
    attempts++;
  } while (greeting === lastGreeting && attempts < maxAttempts);
  
  // Store this greeting for this player
  lastPlayerGreetings.set(playerName, greeting);
  return greeting;
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
      
      // Check if this player is the guild master
      const guildMaster = 'wtfmommy';
      const isGuildMaster = playerName === guildMaster;
      
      // If not guild master, check cooldown
      if (!isGuildMaster) {
        const now = Date.now();
        const lastTime = lastGreetingTime.get(playerName);
        const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
        
        if (lastTime && (now - lastTime) < tenMinutes) {
          // Still in cooldown period, don't greet
          return;
        }
        
        // Update last greeting time
        lastGreetingTime.set(playerName, now);
      }
      
      const greeting = getRandomGreeting(playerName);
      
      setTimeout(() => {
        bot.chat(`/gc ${greeting}`);
      }, 1000);
    }
  }
};
