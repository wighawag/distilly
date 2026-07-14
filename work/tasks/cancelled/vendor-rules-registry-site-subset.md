---
title: Vendor the pluggable rules/profiles registry plus a starter per-site rule subset
slug: vendor-rules-registry-site-subset
spec: distilly-engine
blockedBy: [public-htmltomarkdown-seam-size-presets]
covers: [5, 6]
reason: superseded by re-task — conflated curl.md's pure Profiles (vitepress/docusaurus) with its network Rules (github/mdn). Re-decomposed into `vendor-profile-registry-site-subset` (pure) + `network-fetch-entrypoint-rules` (injected-fetch) per ADR-0001.
---

## Cancelled — superseded by re-task

A build agent surfaced a load-bearing conceptual error: this task conflated upstream
curl.md's network URL-rewriter **Rules** (github/mdn — they FETCH cleaner source, forbidden
on a pure path) with its pure, network-free **Profiles** (vitepress/docusaurus —
generator-keyed content-root selectors). Building it as written was impossible.

Resolved by the decision in `docs/adr/0001-rule-vs-profile-and-injected-fetch.md`: distilly
owns BOTH, cleanly separated. This task is superseded by:

- **`vendor-profile-registry-site-subset`** — the pure Profile registry (covers story 6).
- **`network-fetch-entrypoint-rules`** — the networked `distilly/fetch` entrypoint with the
  injected-`fetch` Rules (covers stories 9, 10).

The original body is retained below for provenance.

## What to build

Vendor curl.md's per-site **rule** + **profile** machinery so distilly matches upstream
extraction quality on tuned sites, and expose it as the PLUGGABLE `rules?` option already
threaded through `htmlToMarkdown` (from the sibling seam task).

End-to-end path this delivers: a caller passes (or omits) `rules` to `htmlToMarkdown`; the
matching rule/profile for the page is selected and fed into the vendored core conversion
(via the profile/content-root machinery the core already reads), producing demonstrably
cleaner markdown than the generic path for at least one representative site.

Scope:

- Vendor the rules registry (`rules.ts`) and `profiles.ts` / `sites.ts` machinery from
  curl.md's `src/md/`, decoupled from the server (no `mod.ts` network wrapper, no `#db`,
  no `hono` FRAMEWORK import). NOTE: the `hono` token that appears in upstream `rules.ts`
  is a SITE rule for `hono.dev` (the docs site) — KEEP that rule; it is not the framework.
- Ship a SOLID STARTER SUBSET of per-site rules (e.g. github, mdn, cloudflare, tailwind,
  zero) — not an exhaustive port (out of scope per the PRD). Carry the rules over faithfully.
- Make the rule set PLUGGABLE: a caller can pass their own `rules` to override/extend, and
  the default (omitted) uses the bundled set. Export whatever public types/registry a
  consumer needs to supply custom rules.
- Salvage from upstream `mod.ts` ONLY the pure rule-application / profile-selection logic
  (which rule matches a page, how a profile is chosen), NOT the request/fetch path.

This completes the "engine vendored, server coupling removed" story (5) and adds the
tuned per-site quality + pluggability (6). It touches the vendored-engine area and
`src/index.ts`'s rule threading, which is why it is serialized after the seam task.

## Acceptance criteria

- [ ] The rules registry + profile/site machinery is vendored under
      `packages/distilly/src`, with no `mod.ts` network wrapper, `#db`, `~/components`, or
      `hono` FRAMEWORK imports (the `hono.dev` SITE rule is kept).
- [ ] A starter subset of per-site rules (at least github and mdn, plus a few more such as
      cloudflare/tailwind/zero) is carried over and active.
- [ ] At least one per-site rule (e.g. github or mdn) demonstrably cleans a representative
      page BETTER than the generic path — a test asserts the rule-applied output is cleaner
      (fewer noise lines / expected content preserved) than the generic conversion of the
      same HTML.
- [ ] The rule set is PLUGGABLE: passing `rules` to `htmlToMarkdown` overrides/extends the
      default; omitting it uses the bundled set. The public types needed to author a custom
      rule are exported.
- [ ] Only the PURE rule-application / profile-selection logic is salvaged from upstream
      `mod.ts`; no request/fetch path is vendored.
- [ ] Tests cover the new behaviour (mirror the repo's vitest style), including the
      site-rule-beats-generic case and the pluggability (custom rule) path.
- [ ] `pnpm format:check && pnpm build && pnpm test` passes.

## Blocked by

- `public-htmltomarkdown-seam-size-presets` — this task wires the rule SET into the
  already-threaded `rules?` option and touches the same engine/`src/index.ts` area, so it
  is serialized after the seam to avoid merge conflicts.

## Prompt

> Goal: vendor curl.md's per-site rule + profile machinery into distilly as the pluggable
> `rules?` option, ship a solid starter subset of site rules, and prove at least one rule
> beats the generic extraction path.
>
> FIRST, check this task against current reality (launch snapshot, may have DRIFTED):
> re-read `work/specs/tasked/distilly-engine.md`, `CONTEXT.md` (domain terms: **rule** = a
> per-site cleanup/extraction rule, the tuned + pluggable part of the engine; **profile** =
> a named extraction config; **vendored engine** = the carved subset of curl.md's
> `src/md/`), and what the two prior tasks landed in `tasks/done/`: how `fromHtml` consumes
> a profile (`vendor-fromhtml-core`) and how `htmlToMarkdown` threads `rules?`
> (`public-htmltomarkdown-seam-size-presets`). Build against the REAL shapes they landed;
> if they contradict this task's premise, route to needs-attention with the discrepancy.
>
> Where to look: upstream is `wevm/curl.md` at `src/md/rules.ts` (the rules registry +
> per-site rules — vendor a starter subset), `src/md/profiles.ts` and `src/md/sites.ts`
> (profile/site machinery), and `src/md/mod.ts` (NETWORK wrapper — salvage ONLY the pure
> rule-application / profile-selection logic, never the fetch path). The repo is MIT, so
> porting its rule tests as a baseline is allowed and encouraged.
>
> Critical carve-out note: the `hono` string in upstream `rules.ts` is a SITE rule for
> `hono.dev` (the docs site) — KEEP it. Do NOT import the `hono` FRAMEWORK, `mod.ts`,
> `transports.ts`, `#db/*`, `~/components`, or any Cloudflare/server code. distilly stays
> dependency-light and MIT-only (it is consumed by AGPL webveil — no GPL/AGPL code here).
>
> Out of scope (PRD): an EXHAUSTIVE port of every curl.md site rule. Ship a solid STARTER
> subset (github, mdn, and a few more like cloudflare/tailwind/zero) and make the set
> pluggable so it can grow later.
>
> Seams to test at: the public `htmlToMarkdown` seam — assert a per-site rule (github or
> mdn) produces cleaner markdown than the generic path on a representative page, and that a
> caller-supplied custom `rules` value is honoured (pluggability). Keep everything pure (no
> network).
>
> "Done" means: the rules/profiles registry is vendored server-free, a starter site-rule
> subset is active, at least one rule demonstrably beats generic extraction (with a test),
> the set is pluggable with exported author-facing types, tests cover it, and
> `pnpm format:check && pnpm build && pnpm test` is green.
>
> RECORD non-obvious in-scope decisions (which exact rules you ported vs deferred, the
> public shape of a custom rule, how profile selection resolves when multiple rules match).
> ADR-gate-worthy ones (see `work/protocol/ADR-FORMAT.md`) → `docs/adr/`; otherwise note in
> the done record.
