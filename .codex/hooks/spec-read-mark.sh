#!/usr/bin/env bash
# PostToolUse, matcher: mcp__.*notion.*
INPUT=$(cat)
V40_ID="3586440a-374b-8112-b439-f99ffcd7c6a8"
mkdir -p "$HOME/.claude"
echo "$INPUT" | grep -q "$V40_ID" && touch "$HOME/.claude/round0-v40-read.flag"
exit 0
