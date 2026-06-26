# CONTEXT.md still claims curl.md's `chunk` was vendored

2026-06-26 (noticed during reconcile-notice-license-deps)

`CONTEXT.md` ("What distilly is") says the engine keeps "the local conversion
(`fromHtml`, `chunk`, `rules/*`, `profiles`)". The landed code did NOT vendor
curl.md's `chunk`; size-preset truncation is distilly's own `src/truncate.ts`.
The `NOTICE` was corrected for this in the reconcile task, but `CONTEXT.md` was
out of that task's scope and still carries the stale `chunk` claim. A small
doc-accuracy fix for whoever touches CONTEXT.md next.
