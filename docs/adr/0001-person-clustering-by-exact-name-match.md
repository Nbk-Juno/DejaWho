# Person clustering by exact-name match (B-lite)

**Status:** accepted

A [[Person]] is inferred from [[Encounter]]s sharing the same normalized name (lowercase, trimmed) under one user. We store this in a lightweight `persons` table loosely joined to `encounters` by `lower(trim(person_name)) = normalized_name` — no foreign key enforcement, because names can change. Summaries are generated lazily by GPT-4o-mini on first Person Card view and invalidated to NULL when a new encounter for that name arrives.

## Why this shape and not a proper Person model

A normalized Person entity (Person table as source of truth, foreign key on encounters, user-confirmed merge UI, fuzzy dedup) is the right long-term model. We deliberately deferred it because:

1. The polish phase's primary goal is brand and UX, not data model overhaul. Schema migrations cascading through encounter creation, edit, and search would balloon scope.
2. The friends-and-family cohort is small enough that the same-name collision case ("two real-world Alexes") is unlikely to matter in v2 polish.
3. The lazy clustering shape preserves the option to migrate to a proper Person table later — `normalized_name` and `encounter_count` are the same fields the eventual Person entity needs.

## Considered options

- **A. Continue with flat `encounter.personName` string, no clustering.** Rejected: makes the "evolving summary" UX impossible without a per-view fan-out and re-grouping. No persistence for the summary, recompute every view.
- **B-lite (chosen).** Lightweight `persons` table with exact-name match, lazy summary, no merge UI.
- **B-full / proper Person model.** Rejected for v2: scope. Slated for Track B.

## Known limitations of B-lite

- Two distinct real-world people with the same name appear merged. Documented in the in-app person-detail copy ("DejaWho groups people by name") and the public privacy/about copy.
- Renaming a person in encounter A but not encounter B silently splits them into two persons. No automatic re-linking.
- No "merge these two persons" or "split this person" UI.

## Future iteration

When the polish phase ships and Track B begins, we revisit:
- Proper `persons` table as source of truth, FK on `encounters.person_id`.
- Fuzzy name matching (Levenshtein, double-metaphone) on encounter create with user-confirmed merge prompt.
- Merge / split UI in the Person Card.
- Backfill migration from the B-lite normalized-name model.

The B-lite shape is structured so that migration is additive — adding a `person_id` column and backfilling it from the existing normalized-name join — rather than a rewrite.
