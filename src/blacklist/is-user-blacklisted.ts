let blacklist: any = { users: [], guilds: [] };
try {
  blacklist = require('./_blacklist.json');
} catch (e) {
  // File doesn't exist, use empty blacklist
}
