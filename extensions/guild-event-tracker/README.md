# Guild Event Tracker Extension

Track GEXP and game statistics for all guild members over a defined time period with automatic daily reports to Discord.

## Features

- **Periodic Stats Tracking**: Automatically fetch and store stats at configurable intervals
- **Multi-Game Support**: Track Bedwars, SkyWars, Cops and Crims, Network Level, and GEXP
- **Per-Player Daily Snapshots**: Individual JSON files for each day in `data/event/{uuid}/day{n}.json`
- **Daily Compiled Reports**: Aggregate data in `data/event/overall.json`
- **Discord Integration**: Automatic daily reports with embeds to specified channel
- **Leaderboards**: Top gainers for GEXP, game wins, and network levels

## Commands

All commands are restricted to Guild Masters and Leaders only.

### Start Event
```
!startevent <name> <startDate> <endDate> <interval>
```

**Example:**
```
!startevent "December Challenge" 2025-12-01 2026-01-01 2h
```

- `name`: Event name (use quotes if contains spaces)
- `startDate`: Start date in YYYY-MM-DD format
- `endDate`: End date in YYYY-MM-DD format
- `interval`: Update interval (e.g., 2h, 30m, 1d)

### Stop Event
```
!stopevent
```
Stops the current event and generates a final report.

### Daily Report
```
!dailyeventreport
```
Manually trigger a daily report to Discord (also runs automatically at midnight).

### Event Status
```
!eventstatus
```
Show current event configuration and status.

## Data Structure

### Per-Player Daily Stats
`data/event/{trimmed-uuid}/day{n}.json`
```json
{
  "uuid": "player-uuid",
  "username": "PlayerName",
  "timestamp": 1234567890,
  "gexp": {
    "weekly": 100000,
    "daily": 15000
  },
  "bedwars": {
    "wins": 500,
    "losses": 300,
    "final_kills": 1200,
    "final_deaths": 800,
    "kills": 2500,
    "deaths": 1800
  },
  "skywars": {
    "wins": 200,
    "losses": 150,
    "kills": 800,
    "deaths": 600
  },
  "copsandcrims": {
    "wins": 50,
    "kills": 300,
    "deaths": 200,
    "headshot_kills": 100
  },
  "networkLevel": 125.5
}
```

### Overall Summary
`data/event/overall.json`
```json
[
  {
    "date": "2025-12-01",
    "totalPlayers": 120,
    "totalGexpGained": 5000000,
    "topGexpGainers": [
      { "username": "Player1", "gained": 150000 },
      ...
    ],
    "topBedwarsWins": [...],
    "topSkywarsWins": [...],
    "topNetworkLevelGain": [...]
  }
]
```

## Discord Reports

Daily reports are automatically sent to Discord channel ID: `522861704921481229`

The embed includes:
- Total players tracked
- Total GEXP gained
- Top 5 GEXP gainers
- Top 5 Bedwars winners
- Top 5 SkyWars winners
- Top 5 Network Level gainers

## Configuration

The extension requires the following environment variables:
- `HYPIXEL_API_KEY`: Your Hypixel API key
- `HYPIXEL_GUILD_ID`: Your guild's Hypixel ID

## Rate Limiting

The extension implements automatic rate limiting with 100ms delays between API requests to comply with Hypixel's API limits.

## Event Persistence

Event configuration is saved to `data/event/event-config.json` and automatically resumes if the bot restarts during an active event.

## Version

1.0.0
