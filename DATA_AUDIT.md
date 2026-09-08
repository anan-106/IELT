# 538 Data Audit

## Scope

The project now treats the IELTS 538 data as two related layers:

1. **Primary core table:** 376 primary words, numbered continuously from 1 to 376.
2. **New-edition target accounting:** 162 additional synonym targets, yielding 538 total learning targets.

The user-provided scanned PDF is an older 剑10-era / 488-target document, but its primary table runs from `1 resemble` through `376 well-being`, so it is used to cross-check the primary word order and table fields. The newer public 538 text is used for the modern group accounting and newer synonym-target information.

## Structural checks enforced at runtime

`data-v2.js` requires:

- exactly 376 primary cards;
- continuous IDs `1..376`;
- group sizes exactly `20 / 100 / 256`;
- no empty primary word;
- no empty Chinese learner gloss;
- no empty source synonym list.

The result is exposed as `window.__IELT_DATA_V2__.audit` and logged in the browser console.

## Source vs learner-normalized fields

The source is not silently corrected. Cards can carry both:

- `sourceWord`, `sourcePos`, `sourceSynonyms`: source-facing fields;
- `word`, `pos`, `quizSynonyms`: normalized study fields;
- `sourceNote`: explanation when the two differ.

### Currently annotated rows

| ID | Word | Source issue / difference | Learning behavior |
| ---: | --- | --- | --- |
| 28 | compensate | source table shows `n.` | study as `v.` |
| 60 | extinct | source table shows `v.` | study as `adj.` |
| 70 | primary | source synonym column shows `principle, main` | preserve source; quiz with `principal, main` |
| 98 | original | some public text extraction shows `fist` | use scan-supported `first` |
| 109 | abandon | newer 538 row contains `derelict` in addition to the old set | add `derelict` |
| 179 | designate | source table shows `n.` for an `appoint` meaning | study as `v.` |
| 228 | harbor / harbour | newer public text and older scan use different US/UK spelling | default to British `harbour`, keep `harbor` alias |

## Spelling aliases

The data layer also recognizes common IELTS-relevant UK/US variants, including:

- recognize / recognise
- analyze / analyse
- emphasize / emphasise
- minimize / minimise
- harbour / harbor
- skepticism / scepticism
- installment / instalment
- encyclopaedia / encyclopedia
- odour / odor
- paralyse / paralyze
- plagiarise / plagiarize
- fertiliser / fertilizer

## Academic expansion

`academic-data.js` currently contains NAWL 1.2 ranks 1–200. At runtime, exact word/alias overlaps with the 538 primary deck are removed before cards are exposed to the study engine.

The memory scheduler itself is unchanged: both decks use the same card state model and localStorage namespace.
