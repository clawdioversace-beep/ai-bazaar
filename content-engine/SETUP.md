# AI Bazaar Content Engine — Setup Guide

## Quick Start (Daily Workflow — ~5 min)

### Option A: Full Morning Run (scrape + report + telegram)
```bash
cd ~/ai-bazaar
bun run morning-run
```
This runs all scrapers, computes hype scores, generates the daily brief, and sends it to your Telegram.

### Option B: Quick Run (skip scraping — just generate from existing data)
```bash
bun run morning-run:quick
```

### Option C: Just the daily report
```bash
bun run daily-report
```
Output: `outputs/daily-brief-YYYY-MM-DD.md`

## Cron Setup (Automated 7am Daily Brief)

### macOS (launchd — recommended)

Create `~/Library/LaunchAgents/com.ai-bazaar.morning-run.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai-bazaar.morning-run</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/clawdioversace/.bun/bin/bun</string>
        <string>run</string>
        <string>morning-run</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/clawdioversace/ai-bazaar</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>TURSO_DATABASE_URL</key>
        <string>file:./dev.db</string>
        <key>PATH</key>
        <string>/Users/clawdioversace/.bun/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/clawdioversace/ai-bazaar/outputs/morning-run.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/clawdioversace/ai-bazaar/outputs/morning-run-error.log</string>
</dict>
</plist>
```

Then load it:
```bash
launchctl load ~/Library/LaunchAgents/com.ai-bazaar.morning-run.plist
```

To unload:
```bash
launchctl unload ~/Library/LaunchAgents/com.ai-bazaar.morning-run.plist
```

### Alternative: crontab
```bash
crontab -e
# Add this line (7am local time):
0 7 * * * cd /Users/clawdioversace/ai-bazaar && TURSO_DATABASE_URL=file:./dev.db /Users/clawdioversace/.bun/bin/bun src/scripts/morning-run.ts >> outputs/morning-run.log 2>&1
```

## Performance Tracking

After posting, log your tweet metrics:
```bash
# Basic: URL, impressions, clicks, content-type
bun run track add "https://x.com/jetpippo/status/123" 500 25 hot-tool-drop

# Extended: add likes, replies, retweets, profile-visits
bun run track add "https://x.com/jetpippo/status/123" 500 25 hot-tool-drop 30 5 8 15

# View recent entries
bun run track list

# Weekly report
bun run track report

# All-time report
bun run track report --all
```

Content types: `hot-tool-drop`, `quick-take`, `web3-ai`, `top-5-thread`, `vs-comparison`, `recap-thread`

## Engagement Radar

Find tweets to reply to:
```bash
bun run engagement-radar
```
Output: `outputs/reply-targets-YYYY-MM-DD.md`

## Claude Project Setup

1. Go to claude.ai → Projects → Create "AI Bazaar Content Engine"
2. Paste the contents of `content-engine/claude-project-instructions.md` as project instructions
3. Each morning, paste the "Claude Prompt Input" section from your daily brief
4. Claude generates tweets → review → schedule via Buffer/Typefully

## File Structure

```
content-engine/
  claude-project-instructions.md  — Paste into Claude Project
  content-calendar.md             — 14-day rotation reference
  SETUP.md                        — This file

src/scripts/
  daily-report.ts                 — Generates daily brief
  track-performance.ts            — Logs tweet metrics
  engagement-radar.ts             — Finds reply targets
  morning-run.ts                  — Orchestrates everything

outputs/                          — Generated files (gitignored)
  daily-brief-YYYY-MM-DD.md
  reply-targets-YYYY-MM-DD.md

data/                             — Persistent data
  tweet-performance.json          — Performance tracker data
```
