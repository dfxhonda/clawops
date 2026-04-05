#!/usr/bin/env bash
# ============================================
# リリーススクリプト
# 使い方: bash scripts/release.sh 1.1.0
# ============================================
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "使い方: bash scripts/release.sh <version>"
  echo "例: bash scripts/release.sh 1.1.0"
  exit 1
fi

# バリデーション
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "エラー: バージョンはセマンティックバージョニング形式 (X.Y.Z) で指定し���ください"
  exit 1
fi

DATE=$(date +%Y-%m-%d)
TAG="v${VERSION}"

echo "📦 リリース: ${TAG} (${DATE})"
echo ""

# 1. package.json のバージョン更新
if command -v jq &> /dev/null; then
  jq --arg v "$VERSION" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
else
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" package.json
fi
echo "✅ package.json → ${VERSION}"

# 2. CHANGELOG.md の [Unreleased] を [X.Y.Z] - YYYY-MM-DD に変換
if ! grep -q '## \[Unreleased\]' CHANGELOG.md; then
  echo "エラー: CHANGELOG.md に [Unreleased] セクションが見つかりません"
  exit 1
fi

# [Unreleased] → [X.Y.Z] - DATE に変換し、新しい [Unreleased] を追加
sed -i '' "s/## \[Unreleased\]/## [Unreleased]\n\n---\n\n## [${VERSION}] - ${DATE}/" CHANGELOG.md
echo "✅ CHANGELOG.md → [${VERSION}] - ${DATE}"

# 3. テスト実行
echo ""
echo "🧪 テスト実行中..."
npm test
echo "✅ テスト全パス"

# 4. git commit + tag
git add package.json CHANGELOG.md
git commit -m "release: ${TAG}"
git tag "${TAG}"
echo "✅ コミット + タグ作成: ${TAG}"

# 5. push指示
echo ""
echo "=========================================="
echo "リリース準備完了！以下を実行してデプロイ:"
echo ""
echo "  git push origin main --tags"
echo ""
echo "GitHub Release 作成:"
echo "  gh release create ${TAG} --title \"${TAG}\" --notes-file <(sed -n '/## \\[${VERSION}\\]/,/^## \\[/p' CHANGELOG.md | head -n -1)"
echo "=========================================="
