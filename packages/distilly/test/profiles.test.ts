// Tests for the PURE, network-free profile registry + detection vendored from
// wevm/curl.md (MIT). Two layers are exercised:
//   1. `detectProfile` / `defineProfile` directly (meta-generator + DOM needles).
//   2. The public `htmlToMarkdown` seam: auto-detection applies a Profile's
//      content-root selectors, a Profile beats generic on identical HTML, and an
//      explicit `rules?: Profile` overrides detection.
// Everything here is pure: no network, no `fetch`.

import {describe, expect, test, vi} from 'vitest';
import {htmlToMarkdown} from '../src/index.js';
import {
	defineProfile,
	detectProfile,
	docusaurus,
	getMetaContent,
	mintlify,
	profiles,
	sphinx,
	starlight,
	vitepress,
} from '../src/md/profiles.js';

function html(props: {body?: string; head?: string}) {
	return `<!doctype html><html><head>${props.head ?? ''}</head><body>${props.body ?? ''}</body></html>`;
}

describe('getMetaContent', () => {
	test('reads name-then-content meta', () => {
		expect(
			getMetaContent(
				'<meta name="generator" content="VitePress">',
				'generator',
			),
		).toBe('VitePress');
	});

	test('reads content-then-name meta (reversed attribute order)', () => {
		expect(
			getMetaContent(
				'<meta content="Docusaurus" name="generator">',
				'generator',
			),
		).toBe('Docusaurus');
	});

	test('returns undefined when absent', () => {
		expect(getMetaContent('<p>no meta</p>', 'generator')).toBeUndefined();
	});
});

describe('detectProfile (meta-generator)', () => {
	test('detects vitepress by generator', () => {
		const detected = detectProfile(
			html({head: '<meta name="generator" content="VitePress v2.0.0">'}),
		);
		expect(detected?.key).toBe('vitepress');
		expect(detected?.contentRootSelectors).toContain('.vp-doc');
		expect(detected?.markers).toContain('meta:generator=VitePress v2.0.0');
	});

	test('detects docusaurus by generator', () => {
		const detected = detectProfile(
			html({head: '<meta name="generator" content="Docusaurus v3.1.0">'}),
		);
		expect(detected?.key).toBe('docusaurus');
	});

	test('detects mintlify by exact generator', () => {
		const detected = detectProfile(
			html({head: '<meta name="generator" content="Mintlify">'}),
		);
		expect(detected?.key).toBe('mintlify');
	});

	test('detects starlight by generator', () => {
		const detected = detectProfile(
			html({head: '<meta name="generator" content="Starlight v0.30">'}),
		);
		expect(detected?.key).toBe('starlight');
	});
});

describe('detectProfile (DOM needles, no generator)', () => {
	test('detects vitepress by VPContent needle', () => {
		const detected = detectProfile(
			html({body: '<div id="VPContent"><p>x</p></div>'}),
		);
		expect(detected?.key).toBe('vitepress');
		expect(detected?.markers).toContain('dom:VPContent');
	});

	test('detects docusaurus by theme-doc-markdown needle', () => {
		const detected = detectProfile(
			html({body: '<div class="theme-doc-markdown"><p>x</p></div>'}),
		);
		expect(detected?.key).toBe('docusaurus');
	});

	test('detects sphinx by needle (sphinx has no generator)', () => {
		const detected = detectProfile(
			html({body: '<div class="sphinxsidebar"></div>'}),
		);
		expect(detected?.key).toBe('sphinx');
		expect(detected?.markers).toContain('dom:sphinx');
	});

	test('detects starlight by sl-markdown-content needle', () => {
		const detected = detectProfile(
			html({body: '<div class="sl-markdown-content"><p>x</p></div>'}),
		);
		expect(detected?.key).toBe('starlight');
	});

	test('detects mintlify by content-area needle', () => {
		const detected = detectProfile(
			html({body: '<div id="content-area"><p>x</p></div>'}),
		);
		expect(detected?.key).toBe('mintlify');
	});
});

describe('detectProfile (no match)', () => {
	test('returns undefined for an unrecognised page', () => {
		expect(
			detectProfile(html({body: '<main><p>plain content</p></main>'})),
		).toBeUndefined();
	});

	test('uses the bundled registry by default', () => {
		expect(profiles.map((p) => p.key)).toEqual([
			'docusaurus',
			'vitepress',
			'mintlify',
			'sphinx',
			'starlight',
		]);
	});

	test('honours a caller-supplied registry (pluggable)', () => {
		const custom = defineProfile({
			contentRootSelectors: ['#mine'],
			detect: {includesAny: {marker: 'dom:mine', needles: ['id="mine"']}},
			key: 'mine',
		});
		const page = html({body: '<div id="mine"><p>x</p></div>'});
		// Not in the bundled set:
		expect(detectProfile(page)).toBeUndefined();
		// Found when the caller passes their own registry:
		expect(detectProfile(page, [custom])?.key).toBe('mine');
	});

	test('returns the FIRST matching detector when several could match', () => {
		// A page that satisfies two detectors' needles; registry order decides.
		const page = html({
			body: '<div id="VPContent"></div><div class="sl-markdown-content"></div>',
		});
		// vitepress precedes starlight in the bundled order.
		expect(detectProfile(page)?.key).toBe('vitepress');
	});
});

describe('htmlToMarkdown auto-detection', () => {
	// A vitepress page whose real content sits inside `.vp-doc`. That content
	// root also carries a generic noise class (`sidebar`), which the generic
	// heuristic would prune. The page advertises its generator, so auto-detection
	// applies the vitepress content-root selectors WITHOUT the caller naming a
	// profile, sparing the root from the noise prune.
	const vitepressPage = html({
		head: '<meta name="generator" content="VitePress v2.0.0">',
		body: '<div class="vp-doc sidebar"><h1>Guide</h1><p>Real documentation body.</p></div>',
	});

	test('a Profile beats generic extraction on identical HTML', async () => {
		const generic = await htmlToMarkdown(vitepressPage, {
			// Force the generic path by passing a no-op profile that declares no
			// content roots, so detection does not kick in.
			rules: {contentRootSelectors: [], key: 'none', markers: []},
		});
		const detected = await htmlToMarkdown(vitepressPage);

		// Generic prunes the `.sidebar` wrapper, losing the real content.
		expect(generic.markdown).not.toContain('# Guide');
		expect(generic.markdown).not.toContain('Real documentation body.');

		// Auto-detected vitepress profile preserves the `.vp-doc` content root.
		expect(detected.markdown).toContain('# Guide');
		expect(detected.markdown).toContain('Real documentation body.');

		// Cleaner = the detected output keeps the expected content the generic
		// path dropped (more signal, no added noise lines).
		const noise = (md: string) =>
			md.split('\n').filter((l) => l.trim() !== '').length;
		expect(noise(detected.markdown)).toBeGreaterThan(noise(generic.markdown));
	});

	test('an unrecognised page falls back to the generic path', async () => {
		const {markdown} = await htmlToMarkdown(
			html({body: '<main><h1>Plain</h1><p>Body</p></main>'}),
		);
		expect(markdown).toContain('# Plain');
		expect(markdown).toContain('Body');
	});

	test('explicit rules override auto-detection', async () => {
		// The page auto-detects as vitepress (`.vp-doc`), but the caller forces a
		// profile whose content root is `#chosen`; detection must NOT win.
		const page = html({
			head: '<meta name="generator" content="VitePress">',
			body: '<div class="vp-doc"><p>vp body</p></div><div id="chosen" class="sidebar"><h1>Chosen</h1></div>',
		});
		const {markdown} = await htmlToMarkdown(page, {
			rules: {contentRootSelectors: ['#chosen'], key: 'custom', markers: []},
		});
		// The explicit profile preserved its own content root.
		expect(markdown).toContain('# Chosen');
	});

	test('auto-detection performs no network call', async () => {
		const fetchSpy = vi.fn();
		const original = globalThis.fetch;
		// @ts-expect-error override for the duration of the test
		globalThis.fetch = fetchSpy;
		try {
			await htmlToMarkdown(vitepressPage);
		} finally {
			globalThis.fetch = original;
		}
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

describe('detector spot-checks for each bundled profile', () => {
	test.each([
		[docusaurus, html({head: '<meta name="generator" content="Docusaurus">'})],
		[vitepress, html({body: '<div class="vp-doc"></div>'})],
		[mintlify, html({body: '<div id="content-container"></div>'})],
		[sphinx, html({body: '<script src="_static/doctools.js"></script>'})],
		[starlight, html({body: '<starlight-tabs></starlight-tabs>'})],
	])('%o matches its representative page', (profile, page) => {
		const detected = profile(page);
		expect(detected?.key).toBe(profile.key);
	});
});
