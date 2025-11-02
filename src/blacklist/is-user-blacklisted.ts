import fs from 'fs';
import path from 'path';

export default (uuid: string) => {
    try {
        // Read the blacklist file dynamically to get the latest data
        const blacklistPath = path.join(process.cwd(), 'src', 'blacklist', '_blacklist.json');
        const blacklistData = fs.readFileSync(blacklistPath, 'utf8');
        const blacklist = JSON.parse(blacklistData) as BlacklistEntry[];
        return blacklist.some((entry) => entry.uuid === uuid);
    } catch (error) {
        console.error('Error reading blacklist:', error);
        return false;
    }
};
