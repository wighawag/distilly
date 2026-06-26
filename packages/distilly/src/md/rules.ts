// Provenance: wevm/curl.md @ e81e116 (approx — see docs/VENDORING.md). Upstream:
//   src/md/rules.ts (+ rules/github.ts, rules/mdn.ts, rules/utils.ts). Closeness:
//   MIXED — individual rewrite functions (githubBlob, vue, reactDev, the appendMd
//   helper) are NEAR-VERBATIM and are the easy fast-path for adding a new docs
//   site; but the HEAVY rules diverge ON PURPOSE: upstream's `github` (auth
//   GraphQL/REST, zod) is replaced by the pure `githubBlob`, and `mdn` STRIPS the
//   {{Compat}}/{{Specifications}} macros upstream fills via network sub-requests.
//   When re-syncing, copy new SIMPLE site rewrites freely; re-derive heavy ones.
//
// Vendored from wevm/curl.md (MIT) — a STARTER SUBSET of the network
// URL-rewriter Rules from `src/md/rules.ts` (+ `rules/github.ts`,
// `rules/mdn.ts`, `rules/utils.ts`). Each rule rewrites a matching page URL to
// a cleaner SOURCE URL (raw markdown, an alternate `.md` endpoint) that is then
// fetched via the caller-injected `fetch` and run through the pure core.
//
// This is a SOLID STARTER SUBSET, not an exhaustive port (an exhaustive port is
// out of scope per the PRD); the set is PLUGGABLE — a caller passes their own
// `rules` array to `urlToMarkdown` to override/extend it.
//
// Intentionally NOT vendored from upstream's heavier rules (kept out to avoid
// hosted/heavy coupling):
//   - the authenticated GitHub GraphQL/REST issue+PR path (needs `zod`, tokens,
//     and HTML-scraping fallbacks — a server concern). `githubBlob` (a pure
//     rewrite to raw source) is the faithful, dependency-light subset.
//   - MDN's `{{Compat}}` / `{{Specifications}}` tables, which upstream fills by
//     fetching `mdn/browser-compat-data` JSON with `zod`. distilly keeps MDN's
//     pure markdown macro normalisation and strips those block macros instead
//     of issuing extra network sub-requests.

import {defineRule, type Extracted, type Rule} from './rule.js';

// --- helpers (ported from curl.md `rules/utils.ts`) ------------------------

/** Append `.md` to the URL path (curl.md `appendMd`). */
function appendMd(key: string, patterns: URLPattern[]): Rule {
	return defineRule({
		key,
		patterns,
		rewrite(url) {
			const mdUrl = new URL(url.href);
			mdUrl.pathname = `${mdUrl.pathname}.md`;
			return mdUrl;
		},
	});
}

// --- github ----------------------------------------------------------------

/**
 * A GitHub `/blob/` markdown URL → its `raw.githubusercontent.com` source, so
 * the cleaner raw markdown is fetched instead of the GitHub web chrome. Faithful
 * to curl.md's `githubBlob`. Non-markdown blobs are left alone (no rewrite).
 */
export const githubBlob = defineRule({
	key: 'githubBlob',
	patterns: [
		new URLPattern({
			hostname: 'github.com',
			pathname: '/:owner/:repo/blob/:path+',
		}),
	],
	rewrite(_url, match) {
		const {owner, repo, path} = match.pathname.groups;
		if (!path || !/\.mdx?$/.test(path)) return undefined;
		return new URL(
			`https://raw.githubusercontent.com/${owner}/${repo}/${path}`,
		);
	},
});

// --- mdn --------------------------------------------------------------------

/**
 * An MDN docs URL → the raw markdown source in `mdn/content` (or
 * `mdn/translated-content` for non-en-US). Faithful to curl.md's `mdn` rewrite;
 * the `extract` keeps MDN's PURE markdown-macro normalisation (cross-reference
 * links, inline status macros, code-fence info-string cleanup) and strips the
 * block macros (`{{Compat}}`, `{{Specifications}}`, sidebars, ...) that upstream
 * fills via extra network sub-requests we intentionally do not vendor.
 */
export const mdn = defineRule({
	key: 'mdn',
	patterns: [
		new URLPattern({
			hostname: 'developer.mozilla.org',
			pathname: '/:locale/docs/:path+',
		}),
		new URLPattern({
			hostname: 'developer.mozilla.org',
			pathname: '/docs/:path+',
		}),
	],
	rewrite(_url, match) {
		const locale = match.pathname.groups.locale?.toLowerCase() ?? 'en-us';
		const repo = locale === 'en-us' ? 'mdn/content' : 'mdn/translated-content';
		const path = match.pathname.groups.path;
		if (!path) return undefined;
		return new URL(
			`https://raw.githubusercontent.com/${repo}/main/files/${locale}/${path.toLowerCase()}/index.md`,
		);
	},
	async extract(response): Promise<Extracted> {
		let text = await response.text();

		let title: string | undefined;
		if (text.startsWith('---\n')) {
			const end = text.indexOf('\n---\n', 4);
			if (end !== -1) {
				const fm = text.slice(4, end);
				title = fm.match(/^title:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, '');
				text = text.slice(end + 5).replace(/^\n+/, '');
			}
		}

		// Strip block-level macros (the network-backed tables we don't vendor,
		// plus sidebar/navigation macros).
		text = text.replace(
			/^\{\{(Specifications|Compat|cssinfo|csssyntax|InheritanceDiagram|APIRef|DefaultAPISidebar|InteractiveExample|EmbedLiveSample|PreviousNext|Previous|Next|NextMenu|PreviousMenu)\b[^}]*\}\}\s*$/gm,
			'',
		);

		// Convert cross-reference macros to linked inline code.
		text = text.replace(
			/\{\{(?:jsxref|cssxref|domxref|HTMLElement|SVGElement|SVGAttr|MathMLElement|CSSXref)\(["']([^"']+)["'](?:,\s*["']([^"']+)["'])?[^)]*\)\}\}/gi,
			(full, ref: string, display: string | undefined) => {
				const label = display ?? ref.split('/').pop() ?? ref;
				const path = xrefPath(ref, full);
				if (!path) return `\`${label}\``;
				return `[\`${label}\`](${path})`;
			},
		);

		// Convert Glossary macros to plain text.
		text = text.replace(
			/\{\{Glossary\(["']([^"']+)["'](?:,\s*["']([^"']+)["'])?[^)]*\)\}\}/gi,
			(_full, ref: string, display: string | undefined) =>
				display ?? ref.replace(/_/g, ' '),
		);

		// Convert inline status macros to text.
		text = text
			.replace(/\{\{optional_inline\}\}/gi, '_(optional)_')
			.replace(/\{\{ReadOnlyInline\}\}/gi, '_(read-only)_')
			.replace(/\{\{Experimental_Inline\}\}/gi, '_(experimental)_')
			.replace(/\{\{Deprecated_Inline\}\}/gi, '_(deprecated)_')
			.replace(/\{\{Non-standard_Inline\}\}/gi, '_(non-standard)_');

		// Strip any remaining macros.
		text = text.replace(/\{\{[^}]+\}\}/g, '');

		// Convert MDN definition lists (`- term\n  - : desc`) to plain items.
		text = text.replace(/^(-\s+.+)\n\s+-\s+:\s+/gm, '$1 — ');

		// Clean code-block info strings.
		text = text
			.replace(
				/^(```\w[\w-]*)(?:\s+(?:example-good|example-bad|hidden|interactive-example(?:-choice)?|live-sample___\S+|-nolint))+\s*$/gm,
				'$1',
			)
			.replace(/^```(\w+)-nolint\s*$/gm, '```$1');

		// Collapse excessive blank lines.
		text = text.replace(/\n{3,}/g, '\n\n');

		return {content: text.trim(), meta: title ? {title} : undefined};
	},
});

const xrefBases: Record<string, string> = {
	jsxref: '/en-US/docs/Web/JavaScript/Reference/Global_Objects/',
	cssxref: '/en-US/docs/Web/CSS/',
	domxref: '/en-US/docs/Web/API/',
	htmlelement: '/en-US/docs/Web/HTML/Element/',
	svgelement: '/en-US/docs/Web/SVG/Element/',
	svgattr: '/en-US/docs/Web/SVG/Attribute/',
	mathmlelement: '/en-US/docs/Web/MathML/Element/',
};

function xrefPath(ref: string, fullMatch: string): string | undefined {
	const macroName = fullMatch.match(/\{\{(\w+)/)?.[1]?.toLowerCase();
	if (!macroName) return undefined;
	const base = xrefBases[macroName];
	if (!base) return undefined;
	let slug = ref.replace(/\(\)$/, '');
	if (macroName === 'jsxref')
		slug = slug.replace(/\./g, '/').replace(/\/prototype\//gi, '/');
	return `${base}${slug}`;
}

// --- a couple more (append-.md docs sites) ---------------------------------

/** react.dev → its `.md` source. Faithful to curl.md's `reactDev`. */
export const reactDev = defineRule({
	key: 'reactDev',
	patterns: [new URLPattern({hostname: 'react.dev'})],
	rewrite(url) {
		if (url.pathname === '/' || url.pathname === '') return undefined;
		const mdUrl = new URL(url.href);
		mdUrl.pathname = `${mdUrl.pathname}.md`;
		return mdUrl;
	},
});

/** vuejs.org → its `.md` source (curl.md's `vue`, via `appendMd`). */
export const vue = appendMd('vue', [new URLPattern({hostname: 'vuejs.org'})]);

/**
 * The bundled starter rule registry. Order matters: {@link matchRule} returns
 * the FIRST rule whose pattern matches. Callers can pass their own array to
 * `urlToMarkdown({ rules })` to override/extend this set.
 */
export const rules: Rule[] = [githubBlob, mdn, reactDev, vue];
