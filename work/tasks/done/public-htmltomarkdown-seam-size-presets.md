---
title: Public htmlToMarkdown seam with size presets and UTF-8-safe truncation
slug: public-htmltomarkdown-seam-size-presets
spec: distilly-engine
blockedBy: [vendor-fromhtml-core]
covers: [1, 2, 4, 8]
---

## What to build

The public, exported entry point distilly consumers depend on:

```ts
htmlToMarkdown(html, { baseUrl?, rules?, size? }): Promise<{ markdown, truncated }>
```

End-to-end path: caller passes HTML it already fetched → the function parses+converts via
the vendored core (`fromHtml`, from the sibling task) using `baseUrl` → it then truncates
the resulting markdown to the requested `size` budget → it returns `{ markdown, truncated }`
where `truncated` is `true` iff the budget actually cut content. No network I/O, no hosted
service: the function is PURE given its HTML input.

Size presets (the `Size` type already stubbed in `src/index.ts`): `s` / `m` / `l` / `f`
≈ 5k / 10k / 25k / full chars. `f` (full) never truncates. Truncation MUST be UTF-8
code-point safe: never split a multi-byte code point (and ideally do not leave a dangling
half of a grapheme); when in doubt cut on a code-point boundary at or before the budget.

Add the `rules?` option to the public signature here (it is part of the pinned public
shape — the current placeholder `HtmlToMarkdownOptions` only declares `baseUrl?`/`size?`,
so you extend it) and thread it to the core; the actual rule SET (the per-site rules +
registry) is a separate sibling task. Until then, accept `rules?`, pass it through, and
default sensibly (generic path) — do not block this task on the rule library.

This task replaces the placeholder `throw new Error('not implemented')` in
`packages/distilly/src/index.ts` with the real implementation and updates the existing
`hello.test.ts` expectation (which currently asserts it throws "not implemented") to the
real behaviour.

The public API shape must match webveil's `Extractor` seam (story 8): `htmlToMarkdown(html,
{ baseUrl?, rules?, size? }) => Promise<{ markdown, truncated }>` and the exported `Size`
type — do not rename or reshape these.

## Acceptance criteria

- [ ] `htmlToMarkdown(html, opts)` is exported from the package root and returns
      `Promise<{ markdown: string; truncated: boolean }>`.
- [ ] `baseUrl` is threaded to the core so relative links resolve to absolute in the
      output (behaviour delivered by the core; assert it at the public seam).
- [ ] Size presets `s`/`m`/`l`/`f` enforce their char budgets; `truncated` is `true` iff
      content was cut, `false` otherwise (and always `false` for `f`).
- [ ] Truncation never splits a UTF-8 code point: a test with multi-byte content
      (emoji / CJK) at the budget boundary asserts the output is valid and uncut mid-code-point.
- [ ] The function performs NO network I/O — a test proves it is pure given its HTML input
      (no fetch/hosted-service call path exists).
- [ ] `rules?` is accepted and threaded through (the rule SET arrives in a sibling task);
      omitting it uses the generic path.
- [ ] The placeholder implementation and the "not implemented" test are replaced with the
      real implementation and real assertions.
- [ ] Tests cover the new behaviour (mirror the repo's vitest style): known HTML → expected
      markdown at the public seam, each size budget + `truncated` flag, and UTF-8-safe
      truncation.
- [ ] `pnpm format:check && pnpm build && pnpm test` passes.

## Blocked by

- `vendor-fromhtml-core` — this seam wraps the vendored core conversion it produces.

## Prompt

> Goal: implement distilly's public `htmlToMarkdown` entry point — wrap the vendored core
> conversion, add `s`/`m`/`l`/`f` size presets with UTF-8-safe truncation and a `truncated`
> flag, and keep the function pure (no network).
>
> FIRST, check this task against current reality (launch snapshot, may have DRIFTED):
> re-read `work/specs/tasked/distilly-engine.md`, `CONTEXT.md`, the current
> `packages/distilly/src/index.ts` (placeholder with the pinned `Size` /
> `HtmlToMarkdownOptions` / `HtmlToMarkdownResult` types), `packages/distilly/test/hello.test.ts`,
> and — crucially — what the `vendor-fromhtml-core` task actually landed in `tasks/done/`
> (the core's real function name/signature and where it lives). If the core landed
> differently than this task assumes, build against what's REAL, and if it contradicts this
> task's premise, route to needs-attention with the discrepancy.
>
> Domain vocabulary: **distill / htmlToMarkdown** is the single public entry point
> (signature pinned by webveil's Extractor seam):
> `htmlToMarkdown(html, { baseUrl?, rules?, size? }) => Promise<{ markdown, truncated }>`.
> A **size preset** `s`/`m`/`l`/`f` ≈ 5k/10k/25k/full chars is the budget the markdown is
> truncated to so agents control context cost.
>
> Where to look: the public surface is `packages/distilly/src/index.ts` (carries the
> pinned `Size` type, an `HtmlToMarkdownOptions` with only `baseUrl?`/`size?` so far, an
> `HtmlToMarkdownResult`, and a throwing placeholder — replace the placeholder body and
> ADD `rules?` to the options type). The conversion engine is whatever
> `vendor-fromhtml-core` vendored under `packages/distilly/src`. curl.md's upstream had a
> `chunk.ts`/`tokenx` for budgeting — you MAY vendor/adapt its truncation logic (MIT) or
> implement a straightforward code-point-safe char-budget truncation; the spec specifies a
> CHAR budget (~5k/10k/25k), so a char-count budget is the contract, not a token count.
>
> Seams to test at: the PUBLIC `htmlToMarkdown` seam only (external behaviour), not
> internals. Assert: known HTML → expected markdown; each size budget enforces its char cap
> and sets `truncated` correctly (`f` never truncates); truncation with multi-byte content
> (emoji/CJK) at the boundary never splits a code point; and the function is pure (no
> network call path). Update `hello.test.ts` away from the "not implemented" assertion.
>
> Privacy invariant (story 4): distilly performs NO network I/O and contacts NO hosted
> service. Do not import or call any fetch/curl.md client path. The caller supplies HTML.
>
> `rules?` is part of the pinned signature — accept it and thread it to the core, but the
> actual rule library is a SEPARATE sibling task (`vendor-rules-registry-site-subset`).
> Default to the generic path when `rules` is omitted; do not block on the rule set.
>
> "Done" means: `htmlToMarkdown` is exported, converts HTML to budgeted clean markdown with
> a correct `truncated` flag, truncates UTF-8-safely, is provably network-free, matches the
> pinned Extractor shape, the placeholder + its test are replaced, and
> `pnpm format:check && pnpm build && pnpm test` is green.
>
> RECORD non-obvious in-scope decisions (e.g. exact char-budget numbers chosen for s/m/l,
> whether you truncate on a code-point vs grapheme boundary, how `truncated` is computed
> relative to trailing-whitespace trimming). ADR-gate-worthy ones (see
> `work/protocol/ADR-FORMAT.md`) → `docs/adr/`; otherwise note in the done record.
