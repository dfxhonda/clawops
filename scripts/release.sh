#!/usr/bin/env bash
# ============================================
# リリーススクリプト
# 使い方: bash scripts/release.sh 1.1.0
# Linux / macOS 両対応
# ============================================
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "使い方: bash scripts/release.sh <version>"
  echo "例: bash scripts/release.sh 1.1.0"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "エラー: バージョンはセマンティックバージョニング形式 (X.Y.Z) で指定してください"
  exit 1
fi

DATE=$(date +%Y-%m-%d)
TAG="v${VERSION}"

echo "📦 リリース: ${TAG} (${DATE})"
echo ""

# --- sed portability: macOS requires -i '', GNU requires -i ---
sedi() {
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

# 1. package.json のバージョン更新
if command -v jq &> /dev/null; then
  jq --arg v "$VERSION" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
else
  sedi "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" package.json
fi
echo "✅ package.json → ${VERSION}"

# 2. CHANGELOG.md の [Unreleased] → [X.Y.Z] - DATE
if ! grep -q '## \[Unreleased\]' CHANGELOG.md; then
  echo "エラー: CHANGELOG.md に [Unreleased] セクションが見つかりません"
  exit 1
fi

# awk で変換（sed の改行処理の環境差を回避）
awk -v ver="${VERSION}" -v dt="${DATE}" '
  /^## \[Unreleased\]/ {
    print "## [Unreleased]"
    print ""
    print "---"
    print ""
    print "## [" ver "] - " dt
    next
  }
  { print }
' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md
echo "✅ CHANGELOG.md → [${VERSION}] - ${DATE}"

# 3. テスト実行
echo ""
echo "🧪 テスト実行中..."
npm test
echo "✅ テスト全パス"

# 4. 整合性チェック
PKG_VER=$(node -p "require('./package.json').version")
if [ "$PKG_VER" != "$VERSION" ]; then
  echo "エラー: package.json のバージョン ($PKG_VER) が指定 ($VERSION) と不一致"
  exit 1
fi
if ! grep -q "## \[${VERSION}\]" CHANGELOG.md; then
  echo "エラー: CHANGELOG.md に [${VERSION}] セクションが見つかりません"
  exit 1
fi
echo "✅ package.json / CHANGELOG.md / tag 整合OK"

# 5. git commit + tag
git add package.json CHANGELOG.md
git commit -m "release: ${TAG}"
git tag "${TAG}"
RELEASE_SHA=$(git rev-parse --short HEAD)
echo "✅ コミット + タグ作成: ${TAG} (${RELEASE_SHA})"

# 6. push指示
echo ""
echo "=========================================="
echo "リリース準備完了！以下を実行してデプロイ:"
echo ""
echo "  git push origin main --tags"
echo ""
echo "GitHub Release 作成:"
echo "  gh release create ${TAG} --title \"${TAG}\""
echo ""
echo "デプロイ後の確認 (sha=${RELEASE_SHA}):"
echo "  curl -s https://clawops.vercel.app/version.json | jq ."
echo "=========================================="
