// Provenance: wevm/curl.md @ e81e116 (approx — see docs/VENDORING.md). Upstream:
//   src/md/profiles.ts + the PURE detection parts of src/md/mod.ts. Closeness:
//   MEDIUM — the profile DATA (per-site contentRootSelectors + detect needles)
//   is near-verbatim and the easy thing to re-sync / add to; the detection
//   helper was carved out of mod.ts (network `resolve`/`markdownUrl` dropped).
//
// Vendored from wevm/curl.md (MIT), `src/md/profiles.ts` + the PURE detection
// parts of `src/md/mod.ts` (`defineProfile.detector` / `detectPageProfile`).
//
// A `Profile` is a per-site extraction config keyed by the page's doc-site
// GENERATOR (vitepress, docusaurus, mintlify, sphinx, starlight, ...). Its
// `contentRootSelectors` tell the converter (`fromHtml`) which DOM subtree is
// the real content. Detection is PURE: it reads only the page's meta-generator
// tag and a set of DOM needles in the HTML the caller already has. NO network,
// NO `fetch`, NO `URLPattern`.
//
// What is intentionally NOT vendored here (it belongs to the separate networked
// `distilly/fetch` Rule task): upstream's `resolve(url)` callback and the
// `markdownUrl` / `markdownRequest` / `normalize` extras it produces. Those are
// network shortcuts (fetch cleaner markdown from an alternate endpoint), so
// they have no place on the pure path. The pure detector resolves a profile to
// exactly the fields `fromHtml` reads: `contentRootSelectors`, `generator`,
// `key`, `markers`.

import type {Profile} from './profile.js';

/**
 * The pure detection config for one site generator. `generator` is matched
 * against the page's `<meta name="generator">` content; `includesAny.needles`
 * are substrings looked for anywhere in the HTML. A profile matches when EITHER
 * the generator regex matches OR any needle is present.
 */
export type ProfileConfig = {
	/** Selectors (`#id` / `.class`) marking known content roots for this site. */
	contentRootSelectors: string[];
	/** What identifies this generator in the page HTML (meta + DOM needles). */
	detect: {
		generator?: RegExp | undefined;
		includesAny: {
			/** Marker recorded when a needle matches (for debugging/parity). */
			marker: string;
			/** Substrings that, if any is present in the HTML, signal this site. */
			needles: string[];
		};
	};
	/** Stable generator key (e.g. `vitepress`). */
	key: string;
};

/**
 * A profile detector: given page HTML, return the matched `Profile` (with the
 * detected `generator` and recorded `markers`) or `undefined`. PURE — reads
 * only the HTML string, no I/O.
 */
export type ProfileDetector = ((
	html: string,
) => Profile<Record<string, unknown>> | undefined) & {
	key: string;
};

/**
 * Build a pure, network-free profile detector from a {@link ProfileConfig}.
 * Mirrors curl.md's `defineProfile`, minus the network `resolve` callback.
 */
export function defineProfile(config: ProfileConfig): ProfileDetector {
	function detector(
		html: string,
	): Profile<Record<string, unknown>> | undefined {
		const generator = getMetaContent(html, 'generator');
		const markers = [
			...(generator && config.detect.generator?.test(generator)
				? [`meta:generator=${generator}`]
				: []),
			...(config.detect.includesAny.needles.some((needle) =>
				html.includes(needle),
			)
				? [config.detect.includesAny.marker]
				: []),
		];
		if (markers.length === 0) return undefined;

		return {
			contentRootSelectors: config.contentRootSelectors,
			generator,
			key: config.key,
			markers,
		};
	}

	return Object.assign(detector, {key: config.key});
}

/**
 * Read a `<meta name="…" content="…">` value out of raw HTML (either attribute
 * order). Used to pull the page's `generator`. Regex over the string, no DOM —
 * faithful to upstream so detection stays cheap and network-free.
 */
export function getMetaContent(html: string, name: string): string | undefined {
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const patterns = [
		new RegExp(
			`<meta[^>]*name=["']${escapedName}["'][^>]*content=["']([^"']+)["'][^>]*>`,
			'i',
		),
		new RegExp(
			`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${escapedName}["'][^>]*>`,
			'i',
		),
	];
	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match?.[1]) return match[1];
	}
	return undefined;
}

// --- Starter subset of generator-keyed profiles ---------------------------
//
// Ported faithfully (selectors + detect rules) from curl.md's `profiles.ts`.
// The network `resolve`/`checks` parts are dropped. This is a SOLID STARTER
// SUBSET, not an exhaustive port (an exhaustive port is out of scope per the
// PRD); the set is pluggable and can grow.

export const docusaurus = defineProfile({
	contentRootSelectors: ['.markdown', '.theme-doc-markdown'],
	detect: {
		generator: /^docusaurus\b/i,
		includesAny: {
			marker: 'dom:__docusaurus',
			needles: [
				'class="theme-doc-markdown',
				'id=__docusaurus',
				'name=docusaurus_locale',
			],
		},
	},
	key: 'docusaurus',
});

export const vitepress = defineProfile({
	contentRootSelectors: ['#VPContent', '.VPContent', '.VPDoc', '.vp-doc'],
	detect: {
		generator: /^vitepress\b/i,
		includesAny: {
			marker: 'dom:VPContent',
			needles: [
				'id="VPContent"',
				'class="VPContent',
				'class="VPDoc',
				'class="vp-doc',
			],
		},
	},
	key: 'vitepress',
});

export const mintlify = defineProfile({
	contentRootSelectors: ['#content-container', '#content-area'],
	detect: {
		generator: /^mintlify$/i,
		includesAny: {
			marker: 'dom:content-area',
			needles: ['id="content-area"', 'id="content-container"'],
		},
	},
	key: 'mintlify',
});

export const sphinx = defineProfile({
	contentRootSelectors: ['.body', '.bodywrapper', '.documentwrapper'],
	detect: {
		includesAny: {
			marker: 'dom:sphinx',
			needles: [
				'_static/doctools.js',
				'class="sphinxsidebar"',
				'data-content_root=',
			],
		},
	},
	key: 'sphinx',
});

export const starlight = defineProfile({
	contentRootSelectors: ['.sl-markdown-content'],
	detect: {
		generator: /^starlight\b/i,
		includesAny: {
			marker: 'dom:starlight__sidebar',
			needles: [
				'id="starlight__sidebar"',
				'class="sl-markdown-content"',
				'<starlight-tabs',
			],
		},
	},
	key: 'starlight',
});

/**
 * The bundled starter profile registry, keyed by generator key. Order matters:
 * {@link detectProfile} returns the FIRST detector that matches. Callers can
 * build their own registry (an array of detectors) and pass it to
 * {@link detectProfile}; or override detection entirely by passing an explicit
 * `rules?: Profile` to `htmlToMarkdown`.
 */
export const profiles: ProfileDetector[] = [
	docusaurus,
	vitepress,
	mintlify,
	sphinx,
	starlight,
];

/**
 * Detect the page's {@link Profile} from its HTML, PURELY (meta-generator + DOM
 * needles). Returns the first matching detector's profile, or `undefined` when
 * no bundled profile recognises the page (caller falls back to the generic
 * path).
 *
 * @param html - The page HTML the caller already has.
 * @param registry - Detectors to try, in order. Defaults to the bundled
 *   {@link profiles}.
 */
export function detectProfile(
	html: string,
	registry: readonly ProfileDetector[] = profiles,
): Profile<Record<string, unknown>> | undefined {
	for (const detector of registry) {
		const detected = detector(html);
		if (detected) return detected;
	}
	return undefined;
}
