---
title: Vendor curl.md's fromHtml core conversion, decoupled from the server
slug: vendor-fromhtml-core
prd: distilly-engine
blockedBy: []
covers: [3, 5]
---

## What to build

Vendor curl.md's pure HTML-to-markdown core from its `src/md/` into distilly's package
so that, given an HTML string (and an optional `baseUrl`), it produces clean markdown on
the unified/rehype/remark stack — with NO server, network, or db coupling.

The end-to-end path this task delivers: a raw HTML string goes in, the unified pipeline
(`rehype-parse` → meta extraction → noise stripping → link resolution → pre/code
normalisation → empty-element stripping → `rehype-remark` → `remark-gfm` →
`remark-stringify`) runs, and clean markdown comes out. `baseUrl` resolves relative
links/images to absolute URLs (and relativizes same-origin absolute URLs) in that output.

This is the FOUNDATION the public `htmlToMarkdown` seam (a sibling task) wraps. It is not
yet the public API — it is the internal conversion function plus the supporting types it
needs, living inside `packages/distilly/src` and exercised by tests, not necessarily
re-exported from the package root yet.

Decoupling required while vendoring (the carve-out boundary, confirmed against upstream):

- The core conversion function imports a `Profile` type `from './mod.ts'` upstream, and
  uses `profile.contentRootSelectors` to recognise known content roots. `mod.ts` is the
  NETWORK wrapper distilly must NOT vendor. So inline / vendor a local `Profile` type
  (and the minimal profile machinery the conversion reads — at least
  `contentRootSelectors`) instead of importing from the network module. Do not pull in
  `mod.ts`, its `fetch`/`create` wrapper, `transports.ts`, or any `hono`/Cloudflare/
  server code.
- Drop any type-only `import type { DB } from '#db/...'` and any `~/components` /
  server-only imports. Replace a `#db`-sourced type with a local string-literal-union or
  inline type as needed.

Carry over the conversion's own behaviour faithfully (meta/frontmatter extraction, noise
stripping of nav/aside/footer/ads/hidden/skip-links, high-link-density pruning, hash-link
unwrapping, `<pre>`/`<code>` flattening, empty-element stripping). Do not re-tune it; the
goal is parity with upstream's pure path.

## Acceptance criteria

- [ ] An internal conversion function turns a raw HTML string into markdown using the
      vendored unified/rehype/remark pipeline (no network, no server imports).
- [ ] A `baseUrl` option resolves relative `href`/`src` to absolute URLs in the output and
      relativizes same-origin absolute URLs, matching upstream behaviour.
- [ ] Headings, paragraphs, lists, tables (GFM), links, and fenced code blocks convert
      correctly; syntax-highlighted `<pre>` collapses to a single clean code block.
- [ ] Noise (nav/aside/footer/script/style, ad/cookie/social class-id blocks, hidden and
      decorative hash-links) is stripped, matching upstream's pure extraction.
- [ ] The `Profile` type and the minimal profile machinery the conversion reads are
      vendored LOCALLY (no `import ... from './mod.ts'`, no `#db`, no `~/components`, no
      `hono`/server imports anywhere in the vendored core).
- [ ] Runtime dependencies the core needs (`unified`, `rehype-parse`, `rehype-remark`,
      `remark-gfm`, `remark-stringify`, plus `hast`/`vfile` types) are added to
      `packages/distilly/package.json`.
- [ ] Tests cover the new behaviour (mirror the repo's existing vitest style): known HTML
      in → expected markdown out for headings/lists/tables/links/code, and `baseUrl` link
      resolution. Where licensing-compatible (curl.md is MIT), port/adapt upstream's own
      `fromHtml` tests as a regression baseline.
- [ ] `pnpm format:check && pnpm build && pnpm test` passes.

## Blocked by

- None — can start immediately.

## Prompt

> Goal: vendor curl.md's pure HTML-to-markdown core (`src/md/fromHtml.ts` and the minimal
> profile types/machinery it depends on) into `packages/distilly/src`, decoupled from the
> server/network/db, as the foundation distilly's public `htmlToMarkdown` will wrap.
>
> FIRST, check this task against current reality (it is a launch snapshot and may have
> DRIFTED): re-read `work/prds/tasked/distilly-engine.md` (the source PRD), `CONTEXT.md`
> (domain terms: distill, size preset, rule, profile, vendored engine), and the existing
> placeholder `packages/distilly/src/index.ts`. If the placeholder or PRD assumptions no
> longer hold, route to needs-attention with the discrepancy rather than building on a
> stale premise.
>
> Domain vocabulary: the **vendored engine** is the subset of curl.md's `src/md/` carved
> into distilly with the network/server/db coupling removed. A **profile** is a named
> extraction config; the core conversion reads `profile.contentRootSelectors` to recognise
> known content roots. **`fromHtml`** is the pure `(html, { baseUrl?, profile? }) =>
> { content, meta }` conversion on the unified/rehype/remark stack.
>
> Where to look: the upstream source is `wevm/curl.md` at `src/md/fromHtml.ts` (the pure
> conversion — vendor this), `src/md/profiles.ts` (the `Profile` shape and profile data),
> and `src/md/mod.ts` (the NETWORK wrapper — do NOT vendor; it only contributes the
> `Profile` TYPE that `fromHtml` imports, which you inline/relocate locally). The repo is
> MIT, so porting its tests as a regression baseline is allowed and encouraged.
>
> Carve-out boundary (verified against upstream): `fromHtml` does `import type { Profile }
> from './mod.ts'` and uses `profile.contentRootSelectors`. Replace that with a locally
> vendored `Profile` type + the minimal profile machinery, so nothing in distilly imports
> `mod.ts`, `transports.ts`, `#db/*`, `~/components`, `hono`, or any Cloudflare/server
> code. The `hono` matches you may see in upstream `rules.ts` are a site-rule for
> `hono.dev` (the docs site), NOT the framework — that is handled in the rules task, not
> here.
>
> Seams to test at: the internal conversion function (HTML string in → markdown out), NOT
> pipeline internals. Assert known HTML → expected markdown for headings/lists/tables/
> links/code, `baseUrl` link resolution (relative → absolute, same-origin → relativized),
> and noise stripping. Keep the function PURE (no I/O); a test must pass with no network.
>
> Licensing: distilly is MIT and consumed by an AGPL downstream (webveil), so vendor ONLY
> MIT-compatible code (curl.md is MIT — fine). Keep `NOTICE`/`LICENSE` accuracy in mind,
> but the focused NOTICE/deps reconciliation is a SEPARATE task — here, just add the
> runtime deps you actually use to `packages/distilly/package.json`.
>
> "Done" means: the core conversion compiles, converts representative HTML to clean
> markdown with `baseUrl` resolution, has no server/network/db imports, is covered by
> tests (incl. ported upstream regression cases where compatible), and
> `pnpm format:check && pnpm build && pnpm test` is green.
>
> RECORD non-obvious in-scope decisions you make (e.g. exactly which profile fields you
> vendored vs stubbed, how you inlined the `Profile` type, any upstream behaviour you had
> to adapt rather than copy). If a choice meets the ADR gate (hard to reverse + surprising
> without context + a real trade-off — see `work/protocol/ADR-FORMAT.md`), write an ADR in
> `docs/adr/`; otherwise note it briefly in the done record / PR description.
