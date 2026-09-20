# Narrative Mock Pair v0 Review

Review target: `mock-pairs-v0.jsonl`

Status: structurally valid, Mirror-evaluated, and product-owner approved.

## Automated validation

- Parsed records: 20
- Unique sample IDs: 20 (`mock-001` through `mock-020`)
- Invalid JSON records: 0
- Missing or extra core answers: 0
- Invalid core option IDs: 0
- Missing or extra Mirror answers: 0
- Invalid Mirror option IDs: 0
- Missing or extra Red Line answers: 0
- Invalid Red Line option IDs: 0
- Invalid Profile values: 0
- Invalid Public Archetype, Private Risk Pattern, or conversation-topic IDs: 0
- Exact duplicate Participant inputs: 0
- Product-owner-approved label sets: 20

Every dimension includes both a zero-distance example and a materially separated example. Observed maximum Participant differences are Ambition 80, Risk 65, Money 61, Product 63, Governance 73, Conflict 70, Operating 83, and External 77.

## Classification coverage

All eight Public Archetype IDs occur as a preferred label. `complementary-builders` is deliberately common at 9 of 20 records; every other identity occurs between one and three times.

All five Private Risk Pattern IDs occur. Twelve records intentionally have no preferred Private Risk Pattern.

Four records declare at least one forbidden public output:

- `mock-006`: do not romanticize contested control as `complementary-monsters`.
- `mock-015`: do not infer `vision-reality` from an acquisition answer.
- `mock-019`: do not romanticize multi-dimensional structural conflict as `complementary-monsters`.
- `mock-020`: do not infer `vision-reality` from an acquisition answer.

This provides explicit negative coverage for both unsafe sensitive inference and narratively attractive but misleading labels.

## Narrative review

The proposed rationales are coherent with the calculated dimension shapes and authority inputs. The set contains intentional comparisons where similar numerical shapes lead to different narrative outcomes because authority, Mirror understanding, tags, or Sensitive Signals differ.

The product owner approved all 20 proposed label sets on 2026-09-20. Each fixture now retains both the original proposal and the matching `approved_labels`, plus approval metadata.

## Mirror evaluation

The calibration question bank now contains complete, symmetric exact/near/opposite relationships for all six Mirror Questions. Every pair of non-identical options occurs exactly once as either near or opposite.

All 20 records have been evaluated against those matrices. See `mock-pairs-v0-approval.md` for the human approval table.
