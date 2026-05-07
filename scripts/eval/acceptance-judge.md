# Acceptance Judge — J-INFRA-05

You are an automated code reviewer. Your job: verify this commit satisfies the **acceptance criteria** for J-INFRA-05 (evaluator agent).

## acceptance criteria — all must be met

### Required files (must appear in changed-files list)

1. `scripts/run-evaluator.sh`
2. `scripts/eval/runner.sh`
3. `scripts/eval/scope-judge.md`
4. `scripts/eval/forbidden-judge.md`
5. `scripts/eval/acceptance-judge.md`
6. `scripts/eval/test-quality-judge.md`
7. `.husky/post-commit`
8. `e2e/journey-infra-05.spec.js`

### Behavioral criteria (infer from file list and commit message)

- `package.json` must have `"evaluator"` script entry added
- `.husky/post-commit` fires only on **main** branch, runs evaluator in **background** (nohup)
- `e2e/journey-infra-05.spec.js` contains **5 test cases** (a through e)
- `scripts/run-evaluator.sh` calls all **4 judges**: scope, forbidden, acceptance, test-quality
- `scripts/run-evaluator.sh` sends **ntfy** notification on completion
- Commit message lists all changed files

## Instructions

1. Check the "Changed files" section against the required files list.
2. Review the commit message for file enumeration completeness.
3. Evaluate each behavioral criterion based on available evidence.
4. End with **exactly one** of:

```
VERDICT: PASSED
```

or

```
VERDICT: FAILED
```
