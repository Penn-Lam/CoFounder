# Domain Docs

This repository uses a single domain-documentation context.

## Before exploring

- Read the root `CONTEXT.md` glossary.
- Read ADRs under `docs/adr/` that affect the area being changed.
- If either source is absent, proceed silently rather than creating placeholder documentation.

## Vocabulary

Use the terms defined in `CONTEXT.md` in issue titles, specs, tests, and implementation. Do not drift to synonyms that the glossary explicitly marks as avoided.

If a required concept is absent, first check whether an existing term already owns that meaning. Record a genuine new concept through the domain-modeling workflow rather than inventing competing vocabulary in implementation.

## ADR conflicts

Surface any proposed change that contradicts an ADR. Name the conflicting ADR and explain why reopening that decision may be justified instead of silently overriding it.
