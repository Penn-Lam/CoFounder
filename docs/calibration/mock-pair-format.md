# Narrative Mock Pair Format

Use this format for the 20 coherent narrative mock Pairs that exercise Jev selection and report composition. These are synthetic editorial fixtures, not evidence about real cofounders.

## File format

Store one compact JSON object per line in a `.jsonl` file. Answers use stable question and option IDs, never copied answer text. Keep LLM-proposed labels separate from labels approved by a human reviewer.

```json
{
  "schema_version": "narrative-mock-v1",
  "sample_id": "mock-001",
  "title": "Long-horizon visionary with cashflow operator",
  "coverage_targets": [
    "public:vision-reality",
    "complement:external",
    "mirror:acquisition-misread"
  ],
  "participants": {
    "a": {
      "profile": {
        "relationship_stages": ["product", "users"],
        "known_duration": "1-3y",
        "worked_duration": "3-12m",
        "responsibilities": ["product", "strategy", "fundraising"],
        "company_authority": "self"
      },
      "pair_answers": {
        "Q1": "C",
        "Q2": "D",
        "Q3": "D",
        "Q4": "A",
        "Q5": "C",
        "Q6": "A",
        "Q7": "B",
        "Q8": "A",
        "Q9": "D",
        "Q10": "B",
        "Q11": "D",
        "Q12": "A",
        "Q13": "A",
        "Q14": "A",
        "Q15": "A",
        "Q16": "B",
        "Q17": "B",
        "Q18": "A",
        "Q19": "A",
        "Q20": "C",
        "Q21": "E",
        "Q22": "A",
        "Q23": "C",
        "Q24": "B"
      },
      "mirror_answers": {
        "Q1": "A",
        "Q4": "C",
        "Q7": "A",
        "Q13": "B",
        "Q16": "C",
        "Q22": "D"
      },
      "red_line_answers": {
        "R1": "B",
        "R2": "B",
        "R3": "C",
        "R4": "B"
      }
    },
    "b": {
      "profile": {
        "relationship_stages": ["product", "users"],
        "known_duration": "1-3y",
        "worked_duration": "3-12m",
        "responsibilities": ["backend", "customer-delivery", "finance"],
        "company_authority": "partner"
      },
      "pair_answers": {
        "Q1": "B",
        "Q2": "E",
        "Q3": "A",
        "Q4": "C",
        "Q5": "C",
        "Q6": "B",
        "Q7": "A",
        "Q8": "B",
        "Q9": "B",
        "Q10": "D",
        "Q11": "B",
        "Q12": "B",
        "Q13": "A",
        "Q14": "B",
        "Q15": "A",
        "Q16": "C",
        "Q17": "D",
        "Q18": "B",
        "Q19": "C",
        "Q20": "B",
        "Q21": "B",
        "Q22": "D",
        "Q23": "B",
        "Q24": "D"
      },
      "mirror_answers": {
        "Q1": "D",
        "Q4": "A",
        "Q7": "B",
        "Q13": "A",
        "Q16": "A",
        "Q22": "A"
      },
      "red_line_answers": {
        "R1": "A",
        "R2": "A",
        "R3": "D",
        "R4": "A"
      }
    }
  },
  "proposed_labels": {
    "preferred_public_archetype": "vision-reality",
    "acceptable_public_archetypes": ["complementary-monsters"],
    "forbidden_public_archetypes": ["research-lab"],
    "preferred_private_risk_pattern": null,
    "narrative_priority": [
      "ambition-gap",
      "external-complement",
      "mirror-acquisition-misread"
    ],
    "conversation_prompt_topics": [
      "acquisition-threshold",
      "cash-at-six-months",
      "company-authority",
      "public-representation",
      "conflict-latency"
    ],
    "rationale": "A supplies long-horizon narrative and external drive; B anchors cashflow and execution. Their authority answers agree on A, so this is complement rather than dual leadership."
  },
  "approved_labels": null,
  "generation": {
    "generator": "replace-with-model-name",
    "prompt_version": "mock-generator-v1"
  }
}
```

The example illustrates shape only. Validate every option against the versioned question bank before accepting a fixture.

## Generation prompt

Paste the current question bank and valid Content IDs after this prompt:

```text
Generate exactly 20 synthetic two-person cofounder test fixtures as JSONL: one valid compact JSON object per line, with no Markdown or commentary.

Follow narrative-mock-v1 exactly. Use only question, option, profile, archetype, risk-pattern, and prompt-topic IDs supplied below. Include all 24 pair answers, all 6 mirror predictions, all 4 red-line answers, and company_authority for both participants. Keep approved_labels null. proposed_labels are editorial suggestions, not ground truth.

Make each Pair internally coherent: answers should express recognizable but non-caricatured working styles. Do not add names, emails, ages, gender, nationality, ethnicity, health, politics, religion, or other protected or identifying attributes.

Across the 20 fixtures, deliberately cover:
- close alignment and severe gaps on every dimension;
- useful complement and destructive mismatch with similar raw distances;
- agreed authority, shared authority, undefined authority, and dual claims to sole authority;
- exact, near, and opposite Mirror predictions;
- red-line conflict and “not discussed” as distinct cases;
- the same numerical shape with different narrative tags;
- every allowed Public Archetype and every Private Risk Pattern;
- ambiguous cases where at least two Public Archetypes are acceptable;
- cases that should fall back to Complementary Builders;
- cases where a tempting archetype must be forbidden because it would imply a Sensitive Topic.

Give each fixture 2–4 coverage_targets, a short neutral title, proposed preferred/acceptable/forbidden classifications, exactly five proposed conversation-prompt topics, and a concise rationale grounded in the supplied answers. Do not calculate scores; the deterministic Rules implementation will do that.

QUESTION BANK AND VALID IDS:
[PASTE THE VERSIONED QUESTION BANK AND CONTENT-ID CATALOG HERE]
```

## Human review

For each line, a reviewer must:

1. Validate every answer ID against the pinned question-set version.
2. Run deterministic Rules and inspect the resulting Pair Feature Vector.
3. Reject incoherent personas or revise their input answers; never edit calculated features.
4. Copy accepted expectations into `approved_labels`, with reviewer and review timestamp kept in the fixture repository metadata.
5. Confirm that preferred and forbidden public outputs reveal no Sensitive Topic.

Only `approved_labels` may be used as evaluation expectations. `proposed_labels` are useful review material but must never make a fixture pass by themselves.
