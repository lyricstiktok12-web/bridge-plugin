import { Bot } from 'mineflayer';
import Bridge from '../../../bridge';

const greetings: string[] = [
  'Welcome back, {player}!',
  '{player} just logged in—welcome!',
  'Hey {player}',
  'Welcome, {player}'
];

let lastGreetingIndex: number = -1;

function getRandomGreeting(playerName: string): string {
  let randomIndex: number;
  
  // Ensure we don't pick the same greeting twice in a row
  do {
    randomIndex = Math.floor(Math.random() * greetings.length);
  } while (randomIndex === lastGreetingIndex && greetings.length > 1);
  
  lastGreetingIndex = randomIndex;
  
  const greeting = greetings[randomIndex];
  if (!greeting) return `Welcome back, ${playerName}!`;
  return greeting.replace('{player}', playerName);
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
      }, 3000);
    }
  }
};
