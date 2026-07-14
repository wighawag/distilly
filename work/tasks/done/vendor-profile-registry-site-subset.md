---
title: Vendor the pure Profile registry plus a starter per-site profile subset
slug: vendor-profile-registry-site-subset
spec: distilly-engine
blockedBy: []
covers: [6]
---

## What to build

Vendor curl.md's pure, network-free **Profile** machinery so distilly matches upstream
extraction quality on tuned doc-site generators, exposed through the already-threaded
pure `rules?: Profile` option on `htmlToMarkdown`.

A **Profile** (per ADR-0001 + `CONTEXT.md`) is a per-site extraction config keyed by the
page's doc-site **generator** (vitepress, docusaurus, mintlify, sphinx, starlight, ...);
its `contentRootSelectors` tell the converter which DOM subtree is the real content. It is
PURE: it operates on HTML the caller already has, with NO network. (This is distinct from
a network **Rule** — that is a separate task; do not confuse the two.)

End-to-end path this delivers: a caller calls `htmlToMarkdown(html, ...)`; the matching
Profile for the page is detected from the HTML (meta-generator + DOM needles) and its
`contentRootSelectors` feed the vendored core (`fromHtml`, already reads
`profile.contentRootSelectors`), producing demonstrably cleaner markdown than the generic
path on at least one representative doc-site page. A caller may also pass a Profile
explicitly via `rules?`; omitting it auto-detects (or falls back to the generic path).

Scope:

- Vendor curl.md's `profiles.ts` data + the PURE profile-selection helper (the network-free
  parts of `detectPageProfile` / `defineProfile.detector(html, url)` — these read only the
  meta-generator and DOM needles, no `URLPattern` / `fetch` / `#db`). Decoupled from the
  server: no `mod.ts`, no `transports.ts`, no `hono`, no Cloudflare/db code.
- Ship a SOLID STARTER SUBSET of profiles (e.g. vitepress, docusaurus, mintlify, sphinx,
  starlight) — not an exhaustive port (out of scope per the spec). Carry them over faithfully.
- Make the set PLUGGABLE: a caller can pass their own Profile via the existing `rules?`
  option (already typed `Profile` in `src/index.ts`) to override/extend; omitting it
  auto-detects from the bundled set. Export the author-facing Profile types/registry.
- Wire auto-detection into `htmlToMarkdown` so a page is matched to its Profile without the
  caller naming one (the seam already accepts an explicit `rules?: Profile`; this adds the
  detect-from-HTML default).

The pure `fromHtml` core and the `rules?: Profile` option already landed (tasks 1 and 2);
this task supplies the Profile DATA + DETECTION that make them useful per-site.

## Acceptance criteria

- [ ] The Profile registry + pure detection helper is vendored under
      `packages/distilly/src/md`, with no `mod.ts` / `transports.ts` / `#db` / `~/components`
      / `hono` / Cloudflare imports, and NO network/`fetch`/`URLPattern` in the detection path.
- [ ] A starter subset of generator-keyed Profiles (at least vitepress and docusaurus, plus
      a few more such as mintlify/sphinx/starlight) is carried over and active.
- [ ] Auto-detection: `htmlToMarkdown(html)` (no explicit `rules`) detects the page's
      Profile from the HTML (meta-generator + DOM needles) and applies its
      `contentRootSelectors`; an unrecognised page falls back to the generic path.
- [ ] At least one Profile demonstrably cleans a representative doc-site page BETTER than
      the generic path — a test asserts the profile-applied output is cleaner (expected
      content preserved / fewer noise lines) than the generic conversion of the SAME HTML
      (network-free; the seam's existing `threads rules (profile)` test prototypes this).
- [ ] Pluggable: passing an explicit `rules?: Profile` overrides detection; the
      author-facing Profile types are exported.
- [ ] Tests cover the new behaviour (mirror the repo's vitest style): detection, the
      profile-beats-generic case on identical HTML, and the explicit-override path.
- [ ] `pnpm format:check && pnpm build && pnpm test` passes.

## Blocked by

- None — can start immediately. (The pure core + `rules?: Profile` option it builds on are
  already in `tasks/done/`.)

## Prompt

> Goal: vendor curl.md's PURE, network-free per-site **Profile** machinery into distilly,
> ship a starter subset of generator-keyed Profiles (vitepress/docusaurus/...), wire
> auto-detection into the existing pure `htmlToMarkdown`, and prove one Profile beats the
> generic extraction path on identical HTML.
>
> FIRST, check this task against current reality (launch snapshot, may have DRIFTED):
> re-read `work/specs/tasked/distilly-engine.md` (story 6), `docs/adr/0001-rule-vs-profile-and-injected-fetch.md`
> (the Profile-vs-Rule split + injected-fetch decision — Profile is PURE/generator-keyed;
> Rule is NETWORK/URL-keyed and is a SEPARATE task), `CONTEXT.md` (domain terms), and what
> tasks 1 and 2 landed in `tasks/done/`: the pure `fromHtml` reading
> `profile.contentRootSelectors` (`src/md/fromHtml.ts` + `src/md/profile.ts`) and the public
> `rules?: Profile` option (`src/index.ts`). Build against the REAL landed shapes; if they
> contradict this task, route to needs-attention.
>
> Critical concept boundary (do NOT repeat the prior conflation that got the old task
> cancelled): a **Profile** is PURE — generator-keyed content-root selectors operating on
> HTML you already have. A **Rule** (github/mdn) is NETWORK — a URL-rewriter that fetches
> cleaner source. THIS task is Profiles ONLY. Do NOT vendor `rules.ts`, `URLPattern`,
> `fetch`, or any network path here — that is the separate `network-fetch-entrypoint-rules`
> task. distilly's pure entrypoint imports no networking.
>
> Where to look: upstream `wevm/curl.md` at `src/md/profiles.ts` (the Profile data +
> `defineProfile`/`detectPageProfile`). `defineProfile.detector(html, url)` reads only the
> meta-generator tag + DOM needles, so it is portable network-free — vendor exactly those
> pure parts. The repo is MIT; porting its profile tests as a baseline is encouraged.
>
> Seams to test at: the public `htmlToMarkdown` seam — assert auto-detection applies a
> Profile's content-root selectors, that a Profile produces cleaner markdown than generic on
> the SAME HTML, and that an explicit `rules?: Profile` overrides detection. Keep everything
> pure (no network).
>
> "Done" means: the Profile registry + pure detection is vendored server-free and
> network-free, a starter generator-keyed subset is active, auto-detection is wired into
> `htmlToMarkdown` with generic fallback, one Profile demonstrably beats generic (with a
> test), the set is pluggable with exported types, tests cover it, and
> `pnpm format:check && pnpm build && pnpm test` is green.
>
> RECORD non-obvious in-scope decisions (which Profiles ported vs deferred, how detection
> resolves when multiple match, the explicit-vs-detected precedence). ADR-gate-worthy ones
> (see `work/protocol/ADR-FORMAT.md`) → `docs/adr/`; otherwise note in the done record.
