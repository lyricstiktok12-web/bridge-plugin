// Blacklist feature disabled
export function isUserBlacklisted(uuid: string): boolean {
  return false;
}

export const blacklist = { users: [], guilds: [] };
export default isUserBlacklisted;
