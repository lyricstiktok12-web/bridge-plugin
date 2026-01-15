import { Bot } from 'mineflayer';
import Bridge from '../../../bridge';

const greetings: string[] = [
  'Welcome back, {player}!',
  '{player} just logged in—welcome!',
  'Hello {player}!',
  '{player} has entered the chat!',
  'Good to see you, {player}!',
  'Yo {player}!'
];

let lastMessage: string = '';

function getRandomGreeting(playerName: string): string {
  let greeting: string;
  let attempts = 0;
  const maxAttempts = 10;
  
  // Keep trying until we get a different message than the last one
  do {
    const randomIndex = Math.floor(Math.random() * greetings.length);
    const template = greetings[randomIndex];
    if (!template) {
      greeting = `Welcome back, ${playerName}!`;
    } else {
      greeting = template.replace('{player}', playerName);
    }
    attempts++;
  } while (greeting === lastMessage && attempts < maxAttempts);
  
  lastMessage = greeting;
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
      }, 1500); // Changed to 1.5 seconds
    }
  }
};
