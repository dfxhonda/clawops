# ブランチ運用

## 基本
- main = 本番保証 (Vercel auto-deploy production)
- dev = 作業ブランチ
- preview分離禁止、main直push (Vercelロールバック1クリックでセーフティネット)

## squash merge
- dev → main は git merge --squash dev
- コミット履歴をmainで1本化

## Conventional Commits
- feat: / fix: / chore: / docs: / refactor:
- Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
