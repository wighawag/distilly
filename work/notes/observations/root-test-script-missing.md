# Root `pnpm test` had no script (verify-gate drift)

2026-06-26 — The `.dorfl.json` verify gate is `pnpm format:check && pnpm build &&
pnpm test`, but the root `package.json` had no `test` script at HEAD, so
`pnpm test` exited 1 (no-op) even on a clean checkout — the gate was never
green. The vendor-fromhtml-core task added a root `test` delegating to
`ldenv pnpm --filter './packages/*' test` (mirroring `build`/`dev`) so the gate
runs. Noting in case the intended wiring was different (e.g. `pnpm -r test`).
