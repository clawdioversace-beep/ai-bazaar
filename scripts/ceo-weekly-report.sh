#!/bin/bash
# CEO Weekly Portfolio Report — synthesizes 7 daily portfolio audits into a prioritized brief
# Runs every Sunday at 11am via LaunchAgent.
# Output saved to outputs/ceo-audits/weekly-report-YYYY-MM-DD.md for Claude CLI interaction.

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
BAZAAR_DIR="/Users/clawdioversace/ai-bazaar"
OUTPUTS_DIR="${BAZAAR_DIR}/outputs"
AUDIT_DIR="${OUTPUTS_DIR}/ceo-audits"
SCRIPTS_DIR="/Users/clawdioversace/.claude/scripts"
CLAUDE_BIN="${HOME}/.local/bin/claude"
GH_BIN="/opt/homebrew/bin/gh"
TODAY=$(date "+%Y-%m-%d")
REPORT_FILE="${AUDIT_DIR}/weekly-report-${TODAY}.md"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# ─── Prerequisites ────────────────────────────────────────────────────────────
mkdir -p "$AUDIT_DIR"

if [ ! -x "$CLAUDE_BIN" ]; then
  echo "ERROR: claude CLI not found at ${CLAUDE_BIN}"
  "${SCRIPTS_DIR}/telegram-notify.sh" --blocker "Weekly report failed: claude CLI not found at ${CLAUDE_BIN}"
  exit 1
fi

# ─── Collect this week's audits (past 7 days) ─────────────────────────────────
echo "[${TODAY}] Collecting daily audits from the past 7 days..."

AUDIT_CONTENT=""
AUDIT_COUNT=0
WEEK_START=$(date -v-6d "+%Y-%m-%d")

for i in 6 5 4 3 2 1 0; do
  DAY=$(date -v-${i}d "+%Y-%m-%d")
  DAY_AUDIT="${AUDIT_DIR}/audit-${DAY}.md"
  if [ -f "$DAY_AUDIT" ]; then
    AUDIT_CONTENT="${AUDIT_CONTENT}
---
### Daily Audit: ${DAY}
$(cat "$DAY_AUDIT")
"
    AUDIT_COUNT=$((AUDIT_COUNT + 1))
  fi
done

if [ "$AUDIT_COUNT" -eq 0 ]; then
  echo "[${TODAY}] ERROR: No daily audits found for this week. Nothing to synthesize."
  "${SCRIPTS_DIR}/telegram-notify.sh" --blocker "Weekly report skipped: no daily audits found for the week of ${TODAY}."
  exit 1
fi

echo "[${TODAY}] Found ${AUDIT_COUNT} daily audits. Synthesizing..."

# ─── Gather portfolio-level weekly stats ──────────────────────────────────────
PORTFOLIO_STATS=""
if command -v gh &>/dev/null || [ -x "$GH_BIN" ]; then
  GH=$(command -v gh 2>/dev/null || echo "$GH_BIN")

  # Commits this week per repo
  WEEKLY_COMMITS=""
  while IFS= read -r repo_name; do
    COUNT=$("$GH" api "repos/clawdioversace/${repo_name}/commits?since=${WEEK_START}T00:00:00Z&per_page=100" \
      --jq 'length' 2>/dev/null) || COUNT="?"
    if [ "$COUNT" != "0" ] && [ "$COUNT" != "?" ]; then
      WEEKLY_COMMITS="${WEEKLY_COMMITS}
- ${repo_name}: ${COUNT} commits"
    fi
  done < <("$GH" repo list --limit 50 --json name --jq '.[].name' 2>/dev/null)

  PORTFOLIO_STATS="=== PORTFOLIO ACTIVITY THIS WEEK ===
Repos with commits:
${WEEKLY_COMMITS:-  (none)}
"
fi

# ─── Assemble synthesis prompt (via temp file for quote safety) ───────────────
cat > "${TMP_DIR}/prompt.txt" <<'PROMPT_HEADER'
You are a CEO doing a weekly strategic review of your entire project portfolio.

PORTFOLIO:
- AI Bazaar: AI/Agent/Web3 tool discovery platform (deployed on Vercel)
- tweet-sniper: Twitter/X monitoring and reply bot
- telegram-bridge: Mission control Telegram bot (Claude Code integration)
- fomo-thesis-evaluator: FOMO Analytics — crypto thesis evaluation
- crawlee-scraper: Web scraping pipeline (Crawlee + Playwright)
- skill-vault / crowdsourced-op-skills / awesome-claude-skills: Open-source Claude skill ecosystem
- claude-skill-up: Gamified Claude Code command discovery
- voicebox: Voice-based tool (early stage)

PROMPT_HEADER

cat >> "${TMP_DIR}/prompt.txt" <<PROMPT_DYNAMIC
WEEK: ${WEEK_START} to ${TODAY}
AUDITS COLLECTED: ${AUDIT_COUNT} of 7 days

${PORTFOLIO_STATS}

=== THIS WEEK'S DAILY PORTFOLIO AUDIT RECOMMENDATIONS ===
${AUDIT_CONTENT}

PROMPT_DYNAMIC

cat >> "${TMP_DIR}/prompt.txt" <<'PROMPT_TASK'
=== YOUR TASK ===

You have reviewed the full portfolio every day this week through 7 rotating lenses (UX, Content/SEO, Growth, Technical, Data Quality, Monetization, Product). Now produce the Weekly Portfolio Report.

The report has 5 sections:

**SECTION 1 — PORTFOLIO HEALTH SNAPSHOT**
One-line status for each active repo: momentum (active/stale/new), biggest win, biggest risk.

**SECTION 2 — WEEKLY THEMES**
Identify 2-3 recurring patterns across multiple days' audits. These are signals worth prioritizing.

**SECTION 3 — TOP 5 PRIORITIZED RECOMMENDATIONS**
From all daily recommendations this week, pick the 5 highest-ROI improvements across the ENTIRE portfolio. Rank by impact x effort ratio. Each must include:
- A clear title with [repo-name]
- What to do (specific, actionable, 1-2 sentences)
- Why it matters (business impact)
- Which day(s) / lens(es) it appeared in
- Estimated effort

**SECTION 4 — QUICK WINS (under 30 min)**
From all recommendations, list any completable in under 30 minutes.

**SECTION 5 — DEFER LIST**
Good recommendations that didn't make top 5 — saved so they're not lost.

Output format — use this exactly:

# CEO Weekly Portfolio Report
## Week of WEEK_START to TODAY
**Audits synthesized:** COUNT/7 daily audits

---

## PORTFOLIO HEALTH SNAPSHOT

| Repo | Momentum | Win | Risk |
|------|----------|-----|------|
| ... | ... | ... | ... |

---

## WEEKLY THEMES

[2-3 bullet points describing recurring patterns]

---

## TOP 5 RECOMMENDATIONS

### 1. [Title] — [repo-name]
**What:** [action]
**Why:** [business impact]
**Source:** [Day/Lens it appeared]
**Effort:** [X hours]

[repeat for 2-5]

---

## QUICK WINS (under 30 min)

[Bulleted list]

---

## DEFER LIST

[Bulleted list — title + one-line summary]
PROMPT_TASK

PROMPT=$(cat "${TMP_DIR}/prompt.txt")

# ─── Invoke Claude CLI ────────────────────────────────────────────────────────
echo "[${TODAY}] Invoking Claude Sonnet for synthesis..."

unset CLAUDECODE 2>/dev/null || true

CLAUDE_OUTPUT=$("$CLAUDE_BIN" -p "$PROMPT" \
  --dangerously-skip-permissions \
  --model sonnet \
  --output-format text \
  --max-budget-usd 0.50 \
  --no-session-persistence \
  2>&1) || true

# ─── Validate output ──────────────────────────────────────────────────────────
if [ -z "$CLAUDE_OUTPUT" ] || [ ${#CLAUDE_OUTPUT} -lt 200 ]; then
  echo "[${TODAY}] WARNING: Empty or too-short output. Retrying once..."
  CLAUDE_OUTPUT=$("$CLAUDE_BIN" -p "$PROMPT" \
    --dangerously-skip-permissions \
    --model sonnet \
    --output-format text \
    --max-budget-usd 0.50 \
    --no-session-persistence \
    2>&1) || true
fi

if [ -z "$CLAUDE_OUTPUT" ] || [ ${#CLAUDE_OUTPUT} -lt 200 ]; then
  echo "[${TODAY}] ERROR: Claude produced no usable output after 2 attempts."
  "${SCRIPTS_DIR}/telegram-notify.sh" --blocker "Weekly report failed: Claude returned empty output. Check outputs/ceo-weekly-report-error.log"
  exit 1
fi

# ─── Save report (printf-based, no heredoc quoting issues) ────────────────────
{
  printf '<!--\n'
  printf '  CEO WEEKLY PORTFOLIO REPORT\n'
  printf '  Generated: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '  Week: %s to %s\n' "$WEEK_START" "$TODAY"
  printf '\n'
  printf '  HOW TO INTERACT WITH THIS IN CLAUDE CLI:\n'
  printf '    cd ~/ai-bazaar && claude outputs/ceo-audits/weekly-report-%s.md\n' "$TODAY"
  printf '\n'
  printf '  SUGGESTED QUERIES ONCE OPEN:\n'
  printf '    "Draft an implementation plan for recommendation #1"\n'
  printf '    "Which of the top 5 can ship this week given a solo developer?"\n'
  printf '    "Which repos need the most attention this week?"\n'
  printf '    "Write the GitHub issue for recommendation #2"\n'
  printf '-->\n\n'
  printf '%s\n' "$CLAUDE_OUTPUT"
} > "$REPORT_FILE"

echo "[${TODAY}] Weekly report saved to ${REPORT_FILE}"

# ─── Send Telegram summary (quote-safe file-based parsing) ────────────────────
printf '%s\n' "$CLAUDE_OUTPUT" > "${TMP_DIR}/output.txt"

THEMES=$(awk '/^## WEEKLY THEMES/,/^---/' "${TMP_DIR}/output.txt" | grep '^\-' | head -3 || true)
TOP3=$(grep -E '^### [123]\.' "${TMP_DIR}/output.txt" | sed 's/^### //' | head -3 || true)
QUICK_COUNT=$(awk '/^## QUICK WINS/,/^## DEFER/' "${TMP_DIR}/output.txt" | grep -c '^\-' || echo "0")

TG_MSG=$(printf '📊 CEO Weekly Portfolio Report — %s\n%s/7 days audited | Week of %s\n\n🔁 Themes:\n%s\n\n🏆 Top 3:\n%s\n\n⚡ Quick wins: %s\n\n📄 Full report: outputs/ceo-audits/weekly-report-%s.md' \
  "$TODAY" "$AUDIT_COUNT" "$WEEK_START" "$THEMES" "$TOP3" "$QUICK_COUNT" "$TODAY")

"${SCRIPTS_DIR}/telegram-notify.sh" --update "$TG_MSG"

echo "[${TODAY}] Telegram notification sent. Done."
