// Vendored from wevm/curl.md (MIT) — the `Profile` type that the pure
// conversion (`fromHtml`) reads. Upstream this type lives in the network
// wrapper `src/md/mod.ts` (`defineProfile.Profile`); distilly must NOT vendor
// that wrapper, so the type is relocated here, decoupled from the
// network/server/db code.
//
// `fromHtml` only reads `profile.contentRootSelectors`; the other fields
// (`key`, `markers`, `generator`, and the per-site `values`) are carried over
// for shape parity so detected profiles from the (separate) profiles/rules
// task slot in without an adapter.

/**
 * A named extraction configuration. The pure conversion reads
 * `contentRootSelectors` to recognise known content roots (so a site's main
 * content is preserved even when generic noise heuristics would prune it).
 */
export type Profile<
	values extends Record<string, unknown> = Record<string, never>,
> = {
	/** Selectors (`#id` / `.class`) marking known content roots for this site. */
	contentRootSelectors: string[];
	generator?: string | undefined;
	key: string;
	markers: string[];
} & values;
