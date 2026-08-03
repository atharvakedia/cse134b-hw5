# CSE 134B HW5 — Design

Evolves the HW2 hand-maintained portfolio into an Eleventy-generated site deployed
from source on Netlify, with two distinct layers of JavaScript.

## Scope

| Part | Deliverable |
| --- | --- |
| 1 | Progressive enhancement — **Option B**, contact-form validation and error reporting |
| 2 | `<quake-feed>` custom element backed by the USGS earthquake GeoJSON feed |
| 3 | Eleventy build, deployed by Netlify on push |
| EC | Pagefind full-text site search |

## Defects carried out of HW2

HW2 shipped three things that are broken on a live URL. They are removed rather
than ported:

1. `project-alpha.html` referenced `assets/trailmate.png`, which does not exist
   (the file is `assets/project-alpha.png`). Broken image.
2. The contact page's `<dialog open>` contained a "Got it" button wired to nothing.
   A visible control that silently does nothing is exactly what Part 1 penalizes.
   Replaced with a static note.
3. `https://analytics.example.invalid/track.js` 404s on every page and the
   `<iframe src="https://trailmate.example.com">` never resolves. Both dropped;
   the third-party-dependency trade-off is discussed in the README instead.

HW2 also had no real CSS — `styles.css` was three lines of debug borders — so the
responsive stylesheet is authored fresh for HW5.

## Structure

```
src/
  _data/site.json              title, author, url, description, nav[], social[], buildYear
  _includes/
    layouts/base.njk           document shell: doctype, head, skip link, page wrapper
    layouts/page.njk           extends base
    layouts/project.njk        the single template behind every case study
    partials/head.njk          title, description, canonical, favicon, CSS/JS refs
    partials/site-header.njk   logo + primary nav, aria-current computed at build
    partials/site-footer.njk   the only source file containing the footer tag
  projects/                    folder of content files = collection source of truth
    trailmate.md
    pixelsort-visualizer.md
    studygroup-finder.md
    projects.11tydata.json     applies layout + tag to the whole directory
  css/styles.css
  js/form-validation.js        Part 1
  js/quake-feed.js             Part 2
  assets/                      images, media, favicon
  index.njk about.njk projects.njk experience.njk contact.njk experiments.njk
  search.njk all.njk 404.njk sitemap.njk
```

Global values (site title, author, nav items, social links, current year) are
defined once in `_data/site.json` and read by the templates. No page hard-codes them.

Navigation state is computed at build time: the header partial compares `page.url`
against each `site.nav` entry and emits `aria-current="page"` on the match.

## Part 1 — form validation

**Baseline, no JavaScript.** The contact form validates natively:

| Field | Constraints |
| --- | --- |
| name | `required minlength=2 maxlength=60 pattern title` |
| email | `type=email required maxlength=254` |
| subject | `required minlength=3 maxlength=100` |
| message | `required minlength=20 maxlength=1000` |

The browser blocks submission and reports errors on its own. CSS supplies the
visual layer through `:user-invalid` / `:user-valid` with no scripting.

**Enhancement.** `js/form-validation.js`, an external module with no inline
handlers and no libraries:

- Each control has an associated `<output>` wired via `aria-describedby` and
  `aria-live="polite"`.
- The script reads `input.validity` and maps `valueMissing`, `typeMismatch`,
  `tooShort`, `tooLong`, and `patternMismatch` to specific human messages.
- On submit failure, focus moves to the first invalid control.
- Every error encountered is pushed to an array of
  `{ field, type, message, timestamp }` and serialized into a hidden
  `name="form-errors"` input.

Native validation stays enabled — `novalidate` is never set. The script does call
`preventDefault()` on the `invalid` event so the browser's own bubble does not
duplicate the `<output>` message; the constraint itself still blocks submission.

The form posts to Netlify Forms so `form-errors` genuinely reaches a destination.

## Part 2 — `<quake-feed>`

Light DOM, so the fallback content between the tags renders when JavaScript is off.

| Attribute | Default | Accepted |
| --- | --- | --- |
| `magnitude` | `2.5` | `all`, `1.0`, `2.5`, `4.5`, `significant` |
| `period` | `day` | `hour`, `day`, `week` |
| `count` | `5` | `1`–`20` |

Endpoint:
`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{magnitude}_{period}.geojson`
— keyless, public domain, and verified to send `access-control-allow-origin: *`.

- `connectedCallback` starts the fetch; `disconnectedCallback` aborts it.
- `attributeChangedCallback` refetches when any observed attribute changes, so
  editing `magnitude` in DevTools visibly changes the rendered list.
- `data-state` reflects `idle`, `loading`, `ready`, `empty`, or `error` so CSS
  can respond without the script styling anything directly.
- 8-second request timeout via `AbortController`; responses cached in
  `sessionStorage` under the feed URL with a 5-minute TTL.
- Results render as an `<ol>` of `<li>`, each cloned from a `<template>` and
  populated with `textContent` / `setAttribute`. No remote value is ever passed
  to `innerHTML`.
- The error state offers a retry button. USGS attribution appears on the page.

Two instances ship: the home page with defaults and the experiments page with
different attributes, so reconfiguration is visible without opening DevTools.

## Part 3 — build and deploy

`netlify.toml` declares `command = "npm run build"` and `publish = "_site"`.
`_site/` and `node_modules/` are gitignored; only source is committed.

`sitemap.xml` and the 404 page are generated from templates. `/all/` is a
browsable listing of every page, used as the no-JavaScript fallback for search.

## Extra credit — Pagefind

`"build": "eleventy && pagefind --site _site"` indexes the generated output on
every deploy. `/search/` uses the Pagefind JavaScript API directly rather than the
bundled UI so the interface matches the site: a real `<form>`, a labeled
`<input type="search">`, and an `aria-live="polite"` result count. `<main>` carries
`data-pagefind-body`; the header and footer carry `data-pagefind-ignore` so shared
chrome does not match every query. A `<noscript>` block explains the requirement
and links `/all/`.
