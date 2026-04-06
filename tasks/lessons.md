# Lessons Learned

## 2026-04-06: ローカル変更の push 忘れ
- **問題**: Auth一本化の修正をローカルで完了しbuild/testもパスしたが、commit+pushを忘れた。「公開mainに反映済み」と報告してしまった
- **根本原因**: `git fetch` + `git diff origin/main` で差分0を確認した時、ローカルの unstaged changes を見落とした。ローカル main = remote main だが、ワーキングツリーの変更が未コミットだった
- **ルール**: 実装完了後は必ず `git status` → `git add` → `git commit` → `git push` → `gh api` で公開main確認のフルフローを実行すること。「差分がない」のではなく「コミットされていない」可能性を常に疑う

## 2026-04-06: GitHub CDNキャッシュによる確認の齟齬
- **問題**: push後にgh api / raw.githubusercontent.comで確認し「反映済み」と報告したが、ユーザー側ではまだ古い内容が見えていた
- **根本原因**: GitHub CDNは地域ごとにキャッシュノードが異なり、raw.githubusercontent.comは最大5分の遅延がある。ツール側とユーザー側で異なるCDNノードにヒットし、結果が食い違った
- **ルール**: ユーザーが「反映されていない」と報告したら、ツールの結果よりユーザーの確認を信頼する。確認URLはコミットSHA指定（`/dfxhonda/clawops/{SHA}/path`）を使うことでCDNキャッシュを回避できる
