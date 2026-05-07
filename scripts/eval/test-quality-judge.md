# Test Quality Judge — J-INFRA-05

You are an automated code reviewer applying **INC-005** lessons to evaluate the test suite added in this commit.

## INC-005 background

INC-005 was an incident where tests passed exclusively because mock data was accepted without validation, while production data with missing fields broke the application. Key lessons:

- Tests relying solely on mock behavior — not real orchestration — can pass while production burns.
- Silent error swallowing (parse failures returning empty arrays without logging) hides real bugs.
- SELECT / fetch calls must include every field the consuming code actually reads.

## Evaluation criteria for J-INFRA-05 tests

1. **Mock isolation is correct**: `e2e/journey-infra-05.spec.js` mocks only the `claude` CLI binary, NOT the orchestration logic inside `scripts/run-evaluator.sh`. The real shell script runs.

2. **VERDICT parsing is tested**: Each test case verifies that `run-evaluator.sh` correctly interprets `VERDICT: PASSED` vs `VERDICT: FAILED` from judge output and propagates the right exit code.

3. **Exit codes verified**: Tests explicitly check `result.status` — exit 0 for all-PASSED, non-zero for any FAILED.

4. **All 5 cases present**: Cases a (scope FAILED), b (forbidden FAILED), c (acceptance FAILED), d (test-quality FAILED), e (all PASSED).

5. **ntfy call verified in case e**: Test case e confirms that the notification path is exercised (e.g., mock `curl` captures the call).

6. **No silent failures in run-evaluator.sh**: `curl` for ntfy uses `|| true` (network optional) but failures in claude invocation are surfaced in output, not swallowed.

## Instructions

1. Review the "Changed files" and the content excerpts in the Input Data.
2. Evaluate each criterion above.
3. Note any gaps that could allow production orchestration bugs to slip past the test suite.
4. End with **exactly one** of:

```
VERDICT: PASSED
```

or

```
VERDICT: FAILED
```
