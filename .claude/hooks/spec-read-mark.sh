#!/usr/bin/env bash
# PostToolUse, matcher: mcp__.*notion.*
INPUT=$(cat)
V40_ID="34c6440a-374b-8199-bea1-c855405a5ab7"
mkdir -p "$HOME/.claude"
echo "$INPUT" | grep -q "$V40_ID" && touch "$HOME/.claude/round0-v40-read.flag"
exit 0
