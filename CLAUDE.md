# clawops AI agent operating manual

## read order
1. This file
2. Notion v5.0 NOW: https://www.notion.so/3586440a374b815db98dff8b8e0a4493
3. Notion specs/target_module
4. Notion modules/target/CLAUDE
5. Notion memory/incidents
6. Notion memory/patterns
7. Notion memory/invariants

## global forbidden patterns
- test.skip(
- test.only(
- @ts-nocheck
- console.log(

## scope rules
Each module has scope.write/scope.forbidden in specs.yaml.
Violation = STOP_AND_ESCALATE.

## done criteria
- vitest all pass
- playwright J-* all green
- test.skip count 0
- main push success
- ntfy notification sent

## escalation triggers
- DB column addition needed
- scope violation
- forbidden_patterns detected
- test cannot pass without test.skip

## infrastructure
- supabase: gedxzunoyzmvbqgwjalx
- vercel: prj_qdMtiFVdGZftIqr7fWWvCMtDp6iZ team dfxhonda
- repo: dfxhonda/clawops
- prod: https://clawops-tau.vercel.app
- ntfy: clawops-hiro-0328
