---
title: Reconcile NOTICE, LICENSE, and dependency manifest with what was actually vendored
slug: reconcile-notice-license-deps
prd: distilly-engine
blockedBy: [network-fetch-entrypoint-rules]
covers: [7]
---

## What to build

A focused accuracy pass so distilly's licensing and dependency declarations match the code
that actually landed after vendoring, making distilly lawfully reusable (MIT) with correct
attribution to curl.md (story 7).

End-to-end: read what the vendoring tasks actually carried over (which files/modules from
curl.md's `src/md/`, which runtime deps the code really imports) and make `NOTICE`,
`LICENSE`, and `packages/distilly/package.json` tell the truth about it.

Scope:

- **`NOTICE`**: confirm it credits wevm/curl.md's MIT copyright and accurately lists what
  was vendored (`fromHtml`, truncation, the pure **Profiles** registry, AND — behind the
  `distilly/fetch` entrypoint — the network **Rules** + the pure rule-dispatch salvaged
  from `mod.ts`) and what was removed (the HOSTED client, the `#db` import, the
  `hono`/Cloudflare/transport coupling; note distilly's own networking is confined to the
  caller-injected `fetch` seam per ADR-0001). Correct it to match what the build tasks
  ACTUALLY vendored (add/remove items as reality dictates) — do not let it claim something
  that was not carried over, or omit something that was.
- **`LICENSE`**: confirm distilly is MIT and the file is correct/complete.
- **`packages/distilly/package.json`**: ensure `dependencies` lists exactly the runtime
  packages the vendored code imports (the unified/rehype/remark set + `tokenx` if used) —
  no missing runtime dep, no leftover unused dep, and NOTHING GPL/AGPL (distilly is MIT and
  is consumed by AGPL webveil, so every runtime dep must be MIT-compatible/permissive).
- Verify (lightweight) the transitive dep set has no copyleft surprise that would taint the
  MIT promise; note any finding.

This is a self-contained reconciliation chore that depends on the vendoring being complete,
so it runs last and audits the real result rather than the plan.

## Acceptance criteria

- [ ] `NOTICE` accurately credits curl.md (MIT, copyright) AND lists what was actually
      vendored vs removed, matching the landed code (no false claims, no omissions).
- [ ] `LICENSE` is present, MIT, and correct.
- [ ] `packages/distilly/package.json` `dependencies` matches exactly the runtime imports
      of the vendored code — no missing, no unused, none GPL/AGPL.
- [ ] A lightweight check confirms no copyleft (GPL/AGPL) runtime dependency taints the MIT
      surface; any concern is recorded (a `work/notes/findings/` doc or a `## Decisions`
      note) rather than left silent.
- [ ] `pnpm format:check && pnpm build && pnpm test` passes (the published `files` set still
      builds and the package is installable/usable as declared).

## Blocked by

- `vendor-rules-registry-site-subset` — this audits what the vendoring tasks actually
  carried over, so it must run after the engine and rules are vendored.

## Prompt

> Goal: make distilly's `NOTICE`, `LICENSE`, and `packages/distilly/package.json` tell the
> TRUTH about the code that was actually vendored from curl.md — correct attribution
> (MIT), accurate vendored/removed list, and an exact, copyleft-free runtime dependency set.
>
> FIRST, check this task against current reality (launch snapshot, may have DRIFTED):
> re-read `work/prds/tasked/distilly-engine.md` (story 7 + the licensing constraints),
> `CONTEXT.md`, the CURRENT `NOTICE` and `LICENSE`, and inspect what the prior tasks landed
> in `tasks/done/` and under `packages/distilly/src` (which curl.md modules were vendored,
> which runtime packages the code imports). Audit the REAL result; if the landed code
> contradicts this task's assumptions, build against reality (and route to needs-attention
> only if something is genuinely irreconcilable).
>
> Domain/licensing context: distilly is MIT and is consumed by an AGPL downstream
> (webveil). MIT is compatible with AGPL, but distilly itself must contain ONLY
> MIT-compatible / permissive code — NO GPL/AGPL runtime dependency may sneak in. The
> vendored engine is the carved subset of curl.md's `src/md/` (curl.md is MIT). `NOTICE`
> credits wevm/curl.md and describes the carve-out (kept: `fromHtml`, chunk/truncation,
> `rules/*`, `profiles`; removed: hosted client, network `mod.ts`, `#db`).
>
> Where to look: `NOTICE` and `LICENSE` at the repo root; `packages/distilly/package.json`
> `dependencies`/`devDependencies`; the vendored sources under `packages/distilly/src` for
> the actual `import` statements that define the real runtime dep set. Cross-check the
> import list against the declared `dependencies`.
>
> Seam / "done": `NOTICE` matches the landed vendored/removed reality; `LICENSE` is MIT and
> correct; declared `dependencies` == actual runtime imports (no missing, no unused), all
> MIT-compatible/permissive; a lightweight copyleft check is recorded; and
> `pnpm format:check && pnpm build && pnpm test` is green. If you find a transitive copyleft
> dependency, capture it as a `work/notes/findings/` doc with its `source:` and flag it
> loudly rather than papering over it.
>
> RECORD non-obvious in-scope decisions (e.g. a dep you dropped/swapped for licensing, an
> attribution wording choice). ADR-gate-worthy ones (see `work/protocol/ADR-FORMAT.md`) →
> `docs/adr/`; otherwise a `## Decisions` note in the done record / PR description.
