let blacklist: any = { users: [], guilds: [] };
try {
  blacklist = require('@blacklist/_blacklist.json');
} catch (e) {
  // File doesn't exist, use empty blacklist
}
