# Vendoring from wevm/curl.md

distilly's engine is **vendored and adapted** from [wevm/curl.md](https://github.com/wevm/curl.md)
(MIT). This is a deliberate **fork-and-adapt**, NOT a tracked dependency: the code was
carved out of curl.md's server/network/db codebase and reshaped to distilly's pure +
injected-fetch design (see `docs/adr/0001-rule-vs-profile-and-injected-fetch.md`). So
taking upstream improvements is a **manual, per-change port**, not a version bump.

This doc records the provenance baseline and the procedure to pull a future update.

## Provenance baseline

| distilly file | upstream source | closeness | notes |
| --- | --- | --- | --- |
| `packages/distilly/src/md/fromHtml.ts` | `src/md/fromHtml.ts` | **HIGH** | conversion logic largely intact; only the `Profile` import was relocated. The easiest file to re-sync. |
| `packages/distilly/src/md/profiles.ts` | `src/md/profiles.ts` + pure parts of `src/md/mod.ts` | **MEDIUM** | the per-site profile DATA is near-verbatim; the detection helper was carved out of `mod.ts` (network `resolve`/`markdownUrl` dropped). |
| `packages/distilly/src/md/profile.ts` | the `Profile` type in `src/md/mod.ts` | **LOW** | a distilly-shaped local type extracted to break the `mod.ts` dependency. Keep in shape-parity, not verbatim. |
| `packages/distilly/src/md/rule.ts` | Rule machinery in `src/md/rules.ts` + dispatch in `src/md/mod.ts` | **LOW** | re-shaped: `defineRule` takes a CALLER-INJECTED fetch (upstream defaults `globalThis.fetch`). Preserve the no-baked-in-fetch invariant. |
| `packages/distilly/src/md/rules.ts` | `src/md/rules.ts` (+ `rules/github.ts`, `rules/mdn.ts`, `rules/utils.ts`) | **MIXED** | simple rewrite fns (`githubBlob`, `vue`, `reactDev`, `appendMd`) are near-verbatim; heavy rules diverge on purpose. |

NOT vendored (distilly's own code, no upstream provenance): `src/index.ts`,
`src/fetch.ts`, `src/truncate.ts` (size-preset truncation — NOT curl.md's `chunk`).

**Baseline upstream commit: `e81e116`** (newest `src/md/` commit observed at vendoring
time, 2026-05-15). Marked "approx" in the file headers because the original vendoring did
not record an exact SHA per file; `e81e116` is the best evidence-based anchor. The FIRST
real update should re-baseline to an exact, verified SHA (see below).

## What we deliberately DROPPED (do not re-introduce on a sync)

These are intentional carve-out boundaries — an upstream change touching them usually does
NOT apply to distilly:

- curl.md's **hosted-service client** and its npm client.
- the **network `mod.ts` fetch wrapper**, incl. its `globalThis.fetch` default. distilly
  bakes in NO `fetch`; the network is reached only through a **caller-injected `fetch`**.
- the type-only **`#db`** import and the **`hono`/Cloudflare/transport** coupling.
- **`tokenx`** source-token accounting and **`zod`**-backed heavy rule paths (authenticated
  GitHub GraphQL/REST, MDN `browser-compat-data` fetches).
- SPA browser-rendering / transport retry logic (a server concern).

The MIT/permissive-only rule stands: distilly is MIT and consumed by AGPL webveil, so
never vendor GPL/AGPL code or a copyleft runtime dep.

## Update procedure (taking an upstream improvement)

When asked to "update distilly with a new curl.md commit/diff":

1. **Pick the target.** Get the upstream commit/range (e.g. `e81e116..<new>`), or a diff
   the user provides.
2. **Scope to the files we vendor.** Only `src/md/fromHtml.ts`, `src/md/profiles.ts`,
   `src/md/rules.ts` (+ `rules/*`), and the bits of `src/md/mod.ts` we salvaged matter.
   Changes to `mod.ts`'s network wrapper, `transports.ts`, `cli/`, `plugins/`, `#db`, or
   `hono` are almost always OUT (see "deliberately DROPPED").
3. **Apply by closeness (above):**
   - **`fromHtml.ts` (HIGH):** upstream hunks usually apply with only the `Profile` import
     re-pointed (`./profile.js`). This is the main place real conversion-quality
     improvements land — prioritise it.
   - **`profiles.ts` (MEDIUM) + new site rules in `rules.ts` (the simple rewrites):** a NEW
     per-site profile or a NEW simple URL-rewrite rule (append-`.md`, host→raw-source) can
     usually be **copied near-verbatim** — add the entry, re-point its import to
     `./rule.js` / local helpers, reformat to our prettier style, register it in the
     exported `rules`/`profiles` array. This is the easy, encouraged fast-path.
   - **`rule.ts` / heavy rules / dispatch (LOW):** do NOT copy verbatim. Re-derive the
     behaviour onto the injected-fetch seam, preserving the no-baked-in-fetch invariant
     (ADR-0001). An auth/`zod`/network-subrequest-heavy upstream rule is normally reduced
     to its pure rewrite (as `github` → `githubBlob`, `mdn` → macro-stripping) or dropped.
4. **Reformat** to distilly's prettier (`useTabs`, `singleQuote`, `bracketSpacing:false`).
5. **Run the gate:** `pnpm format:check && pnpm build && pnpm test`. The vendored
   regression tests (ported from curl.md, MIT) are the safety net.
6. **Re-baseline:** update the `Provenance: wevm/curl.md @ <sha>` line in each touched file
   AND the baseline SHA in this doc to the exact synced commit (drop "approx" once a real
   SHA is verified).
7. **Keep `NOTICE` honest:** if the set of vendored modules/behaviours changed, update
   `NOTICE` to match (it lists kept vs removed).

## Why not just track upstream?

Tracking curl.md closely would force keeping its server/network/`hono`/db coupling — which
is exactly what distilly exists to remove. We chose a clean pure+injected-fetch library
over easy merges. The cost is this manual procedure; the benefit is a dependency-light,
provably-network-free core. The provenance pins above make updates *findable and
reapplyable*, which is the realistic best-of-both.
