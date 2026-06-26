# distilly

Distill HTML into clean, token-efficient markdown for agents. Pure, local, no network by default.

## Install

```
npm install distilly
```

## Usage

The main entry point is pure: you hand it HTML you already have, and it returns markdown. It performs no network I/O.

```ts
import {htmlToMarkdown} from 'distilly';

const {markdown, truncated} = await htmlToMarkdown(html, {
	baseUrl: 'https://example.com/page', // resolve relative links/images
	size: 'm', // 's' | 'm' | 'l' (~5k / 10k / 25k chars) or 'f' (full, default)
});
```

`size` bounds the output to a char budget; `truncated` is `true` only when the budget actually cut content. Per-site extraction `Profile`s are auto-detected from the HTML, or you can pass one explicitly via `rules` to override detection.

## Networked usage (injected fetch)

Optional URL fetching lives behind a separate entrypoint and requires you to inject your own `fetch`. No `fetch` is baked in: omit it and the call throws before any I/O, so a consumer can prove distilly has no egress of its own.

```ts
import {urlToMarkdown} from 'distilly/fetch';

const {markdown, truncated} = await urlToMarkdown('https://example.com/page', {
	fetch, // REQUIRED: the only transport distilly ever uses
	size: 'm',
});
```

The bundled URL-rewriter rules (e.g. GitHub blob → raw, MDN) clean known sources before conversion. Pass your own `rules` array to override or extend them, or `[]` to disable rewriting.

## Why

distilly converts HTML to markdown locally with no baked-in network access. The core is pure; the only way it reaches the network is through a `fetch` you inject yourself, behind the `distilly/fetch` entrypoint.

## License

MIT. Portions are derived from [wevm/curl.md](https://github.com/wevm/curl.md) (MIT); see [`NOTICE`](./NOTICE) and [`docs/VENDORING.md`](./docs/VENDORING.md).
