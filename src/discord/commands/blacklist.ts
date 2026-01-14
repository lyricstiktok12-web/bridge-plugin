// Blacklist command disabled
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('Blacklist feature is currently disabled');

export async function execute(interaction: any) {
  await interaction.reply({ 
    content: 'Blacklist feature is currently disabled.', 
    ephemeral: true 
  });
}
