#!/usr/bin/env bash
# PostToolUse, matcher: mcp__.*notion.*
INPUT=$(cat)
V40_ID="360c15b9-a458-817f-9a87-eb91b8b262e4"
mkdir -p "$HOME/.claude"
echo "$INPUT" | grep -q "$V40_ID" && touch "$HOME/.claude/round0-v6-read.flag"
exit 0
