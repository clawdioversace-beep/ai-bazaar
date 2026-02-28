#!/bin/bash
# CEO Daily Portfolio Audit — tactical improvements across all GitHub repos
# Runs daily at 10am via LaunchAgent, after morning-run (7am) has refreshed data.
# Uses Claude Sonnet via CLI for cost-effective routine analysis (~$0.05/run).

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
BAZAAR_DIR="/Users/clawdioversace/ai-bazaar"
OUTPUTS_DIR="${BAZAAR_DIR}/outputs"
AUDIT_DIR="${OUTPUTS_DIR}/ceo-audits"
SCRIPTS_DIR="/Users/clawdioversace/.claude/scripts"
CLAUDE_BIN="${HOME}/.local/bin/claude"
GH_BIN="/opt/homebrew/bin/gh"
TODAY=$(date "+%Y-%m-%d")
AUDIT_FILE="${AUDIT_DIR}/audit-${TODAY}.md"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# ─── Prerequisites ────────────────────────────────────────────────────────────
mkdir -p "$AUDIT_DIR"

if [ ! -x "$CLAUDE_BIN" ]; then
  echo "ERROR: claude CLI not found at ${CLAUDE_BIN}"
  "${SCRIPTS_DIR}/telegram-notify.sh" --blocker "CEO audit failed: claude CLI not found at ${CLAUDE_BIN}"
  exit 1
fi

if [ ! -f "${SCRIPTS_DIR}/telegram-notify.sh" ]; then
  echo "ERROR: telegram-notify.sh not found"
  exit 1
fi

# ─── Lens rotation (7-day cycle) ─────────────────────────────────────────────
EPOCH_DATE="2026-02-22"
EPOCH_SECONDS=$(date -j -f "%Y-%m-%d" "$EPOCH_DATE" "+%s" 2>/dev/null)
NOW_SECONDS=$(date "+%s")
DAYS_DIFF=$(( (NOW_SECONDS - EPOCH_SECONDS) / 86400 ))
LENS_INDEX=$(( (DAYS_DIFF % 7) + 1 ))

case $LENS_INDEX in
  1) LENS_NAME="UX/Design"
     LENS_DESC="Focus on visual polish, user flows, mobile experience, accessibility, and first-impression impact." ;;
  2) LENS_NAME="Content/SEO"
     LENS_DESC="Focus on copy quality, guide completeness, meta tags, structured data, social previews, and organic discoverability." ;;
  3) LENS_NAME="Growth/Distribution"
     LENS_DESC="Focus on sharing mechanics, social proof, backlink opportunities, community engagement, and virality hooks." ;;
  4) LENS_NAME="Technical/Performance"
     LENS_DESC="Focus on page speed, reliability, error handling, infrastructure, build optimization, and developer experience." ;;
  5) LENS_NAME="Data Quality"
     LENS_DESC="Focus on scraper accuracy, listing quality, dead links, categorization, descriptions, and data completeness." ;;
  6) LENS_NAME="Monetization/Business"
     LENS_DESC="Focus on revenue opportunities, partnerships, sponsor placements, affiliate potential, and business model." ;;
  7) LENS_NAME="Product/Features"
     LENS_DESC="Focus on missing features, user-requested functionality, competitive gaps, and what to build next." ;;
esac

echo "[${TODAY}] Lens: ${LENS_NAME} (index ${LENS_INDEX})"

# ─── Gather context: GitHub portfolio ─────────────────────────────────────────
echo "[${TODAY}] Gathering GitHub repo data..."

REPO_SUMMARY=""
if [ -x "$GH_BIN" ] || command -v gh &>/dev/null; then
  GH=$(command -v gh 2>/dev/null || echo "$GH_BIN")

  # Get all repos with metadata
  REPO_DATA=$("$GH" repo list --limit 50 --json name,url,description,visibility,updatedAt,pushedAt \
    --jq '.[] | "### \(.name) (\(.visibility))\nURL: \(.url)\nDescription: \(.description // "none")\nLast pushed: \(.pushedAt)\n"' 2>/dev/null) || REPO_DATA="(gh repo list failed)"

  # Get recent commits across each repo (last 3 per repo)
  REPO_COMMITS=""
  while IFS= read -r repo_name; do
    COMMITS=$("$GH" api "repos/clawdioversace/${repo_name}/commits?per_page=3" \
      --jq '.[] | "  - \(.commit.message | split("\n")[0]) (\(.commit.author.date | split("T")[0]))"' 2>/dev/null) || COMMITS="  (no recent commits)"
    REPO_COMMITS="${REPO_COMMITS}
**${repo_name}:**
${COMMITS}
"
  done < <("$GH" repo list --limit 50 --json name --jq '.[].name' 2>/dev/null)

  # Get open PRs and issues
  OPEN_PRS=$("$GH" search prs --owner clawdioversace --state open --json repository,title,url \
    --jq '.[] | "- [\(.repository.name)] \(.title)"' 2>/dev/null) || OPEN_PRS="(none)"
  OPEN_ISSUES=$("$GH" search issues --owner clawdioversace --state open --json repository,title,url \
    --jq '.[] | "- [\(.repository.name)] \(.title)"' 2>/dev/null) || OPEN_ISSUES="(none)"

  REPO_SUMMARY="=== GITHUB PORTFOLIO ===
${REPO_DATA}

=== RECENT COMMITS (last 3 per repo) ===
${REPO_COMMITS}

=== OPEN PULL REQUESTS ===
${OPEN_PRS:-None}

=== OPEN ISSUES ===
${OPEN_ISSUES:-None}"
else
  REPO_SUMMARY="(gh CLI not available — GitHub data skipped)"
fi

# ─── Gather context: AI Bazaar specifics (deployed product) ───────────────────
LATEST_BRIEF=$(ls -t "${OUTPUTS_DIR}"/daily-brief-*.md 2>/dev/null | head -1)
if [ -n "$LATEST_BRIEF" ]; then
  BRIEF_EXCERPT=$(head -60 "$LATEST_BRIEF")
else
  BRIEF_EXCERPT="(No daily brief found)"
fi

CONTINUE_FILE="${BAZAAR_DIR}/.planning/.continue-here.md"
if [ -f "$CONTINUE_FILE" ]; then
  REMAINING_WORK=$(sed -n '/<remaining_work>/,/<\/remaining_work>/p' "$CONTINUE_FILE" | head -20)
else
  REMAINING_WORK="(No .continue-here.md found)"
fi

# ─── Gather context: past audit recommendations ──────────────────────────────
PAST_RECS=""
AUDIT_FILES=$(ls -t "${AUDIT_DIR}"/audit-*.md 2>/dev/null | head -5) || AUDIT_FILES=""
if [ -n "$AUDIT_FILES" ]; then
  for f in $AUDIT_FILES; do
    DATE_PART=$(basename "$f" .md | sed 's/audit-//')
    RECS=$(grep -E '^## [0-9]+\.' "$f" 2>/dev/null | sed 's/^## /- /' || true)
    if [ -n "$RECS" ]; then
      PAST_RECS="${PAST_RECS}[${DATE_PART}]
${RECS}
"
    fi
  done
fi

if [ -z "$PAST_RECS" ]; then
  PAST_RECS="(No previous audits found)"
fi

# ─── Assemble prompt (written to temp file to avoid quoting issues) ──────────
cat > "${TMP_DIR}/prompt.txt" <<'PROMPT_HEADER'
You are a CEO doing a daily 5-minute strategic audit across your entire project portfolio.

PORTFOLIO OVERVIEW:
- AI Bazaar: Opinionated discovery platform for AI/Agent/Web3 tools. Live at https://ai-bazaar-eight.vercel.app. Stack: Next.js 16, React 19, Drizzle ORM, libSQL, Tailwind CSS, Vercel.
- tweet-sniper: Automated Twitter/X monitoring and reply bot. Stack: TypeScript, Bun.
- telegram-bridge (telegram-overseer-bot): Mission control Telegram bot — capture, relay, Claude Code integration. Stack: TypeScript, Bun.
- fomo-thesis-evaluator: FOMO Analytics — crypto thesis evaluation tool. Stack: TypeScript.
- crawlee-scraper: Web scraping pipeline with Crawlee + Playwright. Stack: TypeScript, Node.
- skill-vault / crowdsourced-op-skills / awesome-claude-skills: Open-source Claude skill ecosystem repos.
- claude-skill-up: Gamified Claude Code command discovery tool.
- voicebox: Voice-based tool (early stage).

PROMPT_HEADER

cat >> "${TMP_DIR}/prompt.txt" <<PROMPT_DYNAMIC
TODAY'S DATE: ${TODAY}
TODAY'S FOCUS LENS: ${LENS_NAME}
${LENS_DESC}

${REPO_SUMMARY}

=== AI BAZAAR DATA (deployed product) ===
${BRIEF_EXCERPT}

=== KNOWN REMAINING WORK ===
${REMAINING_WORK}

=== PREVIOUS AUDIT RECOMMENDATIONS (DO NOT REPEAT) ===
${PAST_RECS}

PROMPT_DYNAMIC

cat >> "${TMP_DIR}/prompt.txt" <<'PROMPT_TASK'
=== YOUR TASK ===

Review the portfolio through today's focus lens. Produce exactly 3 quick tactical improvements.

- At least 1 recommendation should target AI Bazaar (the live deployed product)
- At least 1 recommendation should target a different repo in the portfolio
- Each improvement must be completable by one developer in approximately 2 hours
- Be specific: name exact repos, files, pages, components, API routes, or actions to take
- Each must have a clear business rationale (more traffic, better retention, higher quality, cross-repo synergy, etc.)
- Do NOT suggest anything already in the "previous recommendations" list above
- Do NOT suggest broad strategic pivots — these are small, high-impact tactical wins
- If a repo has been inactive, consider whether it needs attention or should be deprioritized

Output format (use this exactly):

## 1. [Concise title] — [repo-name]
**What:** [1-2 sentences describing the specific action]
**Why:** [One sentence on business impact]
**Files:** [Key files to touch, or "N/A" if non-code action]
**Effort:** [X hours]

## 2. [Concise title] — [repo-name]
**What:** [1-2 sentences describing the specific action]
**Why:** [One sentence on business impact]
**Files:** [Key files to touch, or "N/A" if non-code action]
**Effort:** [X hours]

## 3. [Concise title] — [repo-name]
**What:** [1-2 sentences describing the specific action]
**Why:** [One sentence on business impact]
**Files:** [Key files to touch, or "N/A" if non-code action]
**Effort:** [X hours]
PROMPT_TASK

PROMPT=$(cat "${TMP_DIR}/prompt.txt")

# ─── Invoke Claude CLI ───────────────────────────────────────────────────────
echo "[${TODAY}] Invoking Claude Sonnet..."

unset CLAUDECODE 2>/dev/null || true

CLAUDE_OUTPUT=$("$CLAUDE_BIN" -p "$PROMPT" \
  --dangerously-skip-permissions \
  --model sonnet \
  --output-format text \
  --max-budget-usd 0.25 \
  --no-session-persistence \
  2>&1) || true

# ─── Validate output ─────────────────────────────────────────────────────────
if [ -z "$CLAUDE_OUTPUT" ] || [ ${#CLAUDE_OUTPUT} -lt 100 ]; then
  echo "[${TODAY}] WARNING: Empty or too-short output. Retrying once..."
  CLAUDE_OUTPUT=$("$CLAUDE_BIN" -p "$PROMPT" \
    --dangerously-skip-permissions \
    --model sonnet \
    --output-format text \
    --max-budget-usd 0.25 \
    --no-session-persistence \
    2>&1) || true
fi

if [ -z "$CLAUDE_OUTPUT" ] || [ ${#CLAUDE_OUTPUT} -lt 100 ]; then
  echo "[${TODAY}] ERROR: Claude produced no usable output after 2 attempts."
  "${SCRIPTS_DIR}/telegram-notify.sh" --blocker "CEO audit failed: Claude returned empty output. Check logs at outputs/ceo-audit-error.log"
  exit 1
fi

# ─── Save audit to archive ───────────────────────────────────────────────────
# Write to temp file first to avoid heredoc quoting issues with Claude output
{
  printf '# CEO Daily Portfolio Audit — %s\n' "$TODAY"
  printf '**Lens:** %s\n' "$LENS_NAME"
  printf '**Model:** Claude Sonnet\n'
  printf '**Generated:** %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '**Scope:** All GitHub repos\n'
  printf '\n---\n\n'
  printf '%s\n' "$CLAUDE_OUTPUT"
} > "$AUDIT_FILE"

echo "[${TODAY}] Audit saved to ${AUDIT_FILE}"

# ─── Send to Telegram (quote-safe parsing via temp files) ─────────────────────
# Write Claude output to temp file and parse with grep/sed on the file (not variables)
printf '%s\n' "$CLAUDE_OUTPUT" > "${TMP_DIR}/output.txt"

TG_RECS=""
while IFS= read -r line; do
  TG_RECS="${TG_RECS}${line}
"
done < <(grep -E '^## [0-9]+\.' "${TMP_DIR}/output.txt" | sed 's/^## //' || true)

# Also grab the "What" lines
while IFS= read -r line; do
  what=$(printf '%s' "$line" | sed 's/^\*\*What:\*\* //')
  TG_RECS="${TG_RECS}→ ${what}
"
done < <(grep -E '^\*\*What:\*\*' "${TMP_DIR}/output.txt" || true)

TG_MSG=$(printf '🔍 CEO Portfolio Audit — %s\nLens: %s\n\n%s\n📄 Full audit: outputs/ceo-audits/audit-%s.md' \
  "$TODAY" "$LENS_NAME" "$TG_RECS" "$TODAY")

"${SCRIPTS_DIR}/telegram-notify.sh" --update "$TG_MSG"

echo "[${TODAY}] Telegram notification sent. Done."
