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
      
      const greeting = getRandomGreeting(playerName);
      
      setTimeout(() => {
        bot.chat(`/gc ${greeting}`);
      }, 1000);
    }
  }
};
