import { Bot } from 'mineflayer';
import Bridge from '../../../bridge';

const greetings: string[] = [
  'Welcome back, {player}!',
  '{player} just logged in—welcome!',
  'Hey {player}',
  'Welcome, {player}'
];

function getRandomGreeting(playerName: string): string {
  const randomIndex = Math.floor(Math.random() * greetings.length);
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
