/**
 * <quake-feed> — recent earthquakes from the U.S. Geological Survey.
 *
 * Attributes (all optional, all observed):
 *   magnitude  "all" | "1.0" | "2.5" | "4.5" | "significant"   default "2.5"
 *   period     "hour" | "day" | "week"                         default "day"
 *   count      1–20                                            default 5
 *
 * Endpoint:
 *   https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{magnitude}_{period}.geojson
 *   Keyless, public domain, and CORS-enabled. No credential is involved, so
 *   there is nothing to leak into the client bundle.
 *
 * The element uses the light DOM on purpose: whatever the author writes
 * between the tags stays visible until the element upgrades, which makes the
 * no-JavaScript fallback the default rather than an afterthought.
 */

const FEED_BASE = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/";
const FEED_ORIGIN = "https://earthquake.usgs.gov/";

const VALID_MAGNITUDES = ["all", "1.0", "2.5", "4.5", "significant"];
const VALID_PERIODS = ["hour", "day", "week"];

const DEFAULT_MAGNITUDE = "2.5";
const DEFAULT_PERIOD = "day";
const DEFAULT_COUNT = 5;
const MIN_COUNT = 1;
const MAX_COUNT = 20;

/** A hung network must not leave the widget spinning forever. */
const REQUEST_TIMEOUT_MS = 8000;

/** Reloading during development should not hammer a free public service. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = "quake-feed:";
const CACHE_MAX_ITEMS = MAX_COUNT;

/*
 * Both templates below are static markup written by hand. No value that came
 * back from the network is ever concatenated into an HTML string — remote
 * fields are written with textContent and setAttribute only. A `place` field
 * containing `<img src=x onerror=...>` would execute if it were interpolated
 * into innerHTML; through textContent it is just characters on the screen.
 */
const shellTemplate = document.createElement("template");
shellTemplate.innerHTML = `
  <p class="quake-status" role="status"></p>
  <ol class="quake-list"></ol>
  <button class="quake-retry" type="button" hidden>Try again</button>
  <p class="quake-attribution">Data from the
    <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php">U.S. Geological Survey</a>
    earthquake feed.</p>`;

const itemTemplate = document.createElement("template");
itemTemplate.innerHTML = `
  <li>
    <span class="quake-mag"></span>
    <a class="quake-place"></a>
    <time></time>
  </li>`;

/** Reads a cached feed, ignoring anything stale, malformed, or unreadable. */
function readCache(url) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || Date.now() - entry.storedAt > CACHE_TTL_MS) return null;
    return Array.isArray(entry.features) ? entry.features : null;
  } catch {
    // Storage can be disabled, full, or throw in private browsing.
    // Caching is an optimisation, so failing to read it is not an error.
    return null;
  }
}

function writeCache(url, features) {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + url,
      JSON.stringify({
        storedAt: Date.now(),
        features: features.slice(0, CACHE_MAX_ITEMS),
      }),
    );
  } catch {
    // Quota exceeded or storage unavailable — carry on without a cache.
  }
}

function formatMagnitude(mag) {
  return typeof mag === "number" && Number.isFinite(mag)
    ? `M ${mag.toFixed(1)}`
    : "M —";
}

function formatTime(epochMs) {
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return null;
  return {
    iso: date.toISOString(),
    label: date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

/**
 * Only USGS event pages get linked. Without this check a hostile or corrupted
 * feed could hand us a `javascript:` URL and we would happily install it.
 */
function isSafeEventUrl(value) {
  return typeof value === "string" && value.startsWith(FEED_ORIGIN);
}

class QuakeFeed extends HTMLElement {
  static observedAttributes = ["magnitude", "period", "count"];

  /** Aborts the in-flight request on disconnect, timeout, or reconfiguration. */
  #request = null;
  /** Removes DOM listeners on disconnect. */
  #listeners = null;
  #timeoutId = null;
  #timedOut = false;
  #refs = null;

  connectedCallback() {
    if (!this.#refs) this.#buildShell();

    this.#listeners = new AbortController();
    this.#refs.retry.addEventListener("click", () => this.#load(), {
      signal: this.#listeners.signal,
    });

    this.#load();
  }

  disconnectedCallback() {
    this.#cancelRequest();
    this.#listeners?.abort();
    this.#listeners = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    // During upgrade this fires before connectedCallback; the initial load is
    // that callback's job, so there is nothing to do until the shell exists.
    if (!this.#refs || !this.isConnected) return;
    this.#load();
  }

  /* ---- Attribute reading: invalid values fall back rather than throw ---- */

  get magnitude() {
    const value = (this.getAttribute("magnitude") ?? "").toLowerCase();
    return VALID_MAGNITUDES.includes(value) ? value : DEFAULT_MAGNITUDE;
  }

  get period() {
    const value = (this.getAttribute("period") ?? "").toLowerCase();
    return VALID_PERIODS.includes(value) ? value : DEFAULT_PERIOD;
  }

  get count() {
    const parsed = Number.parseInt(this.getAttribute("count") ?? "", 10);
    if (!Number.isFinite(parsed)) return DEFAULT_COUNT;
    return Math.min(Math.max(parsed, MIN_COUNT), MAX_COUNT);
  }

  get feedUrl() {
    return `${FEED_BASE}${this.magnitude}_${this.period}.geojson`;
  }

  /* ---------------------------- Rendering ---------------------------- */

  /** Replaces the author's fallback content with the element's own UI. */
  #buildShell() {
    this.replaceChildren(shellTemplate.content.cloneNode(true));
    this.#refs = {
      status: this.querySelector(".quake-status"),
      list: this.querySelector(".quake-list"),
      retry: this.querySelector(".quake-retry"),
    };
    this.#setState("idle", "Ready to load recent earthquakes.");
  }

  /**
   * The single place that touches state. Everything visual — the spinner, the
   * error colour, the retry button — keys off data-state in the stylesheet.
   */
  #setState(state, message) {
    this.dataset.state = state;
    this.#refs.status.textContent = message;
    this.#refs.retry.hidden = state !== "error";
    if (state === "loading") {
      this.setAttribute("aria-busy", "true");
    } else {
      this.removeAttribute("aria-busy");
    }
  }

  #describeQuery() {
    const magnitude =
      this.magnitude === "all"
        ? "all magnitudes"
        : this.magnitude === "significant"
          ? "significant quakes"
          : `magnitude ${this.magnitude} and above`;
    const period = { hour: "past hour", day: "past day", week: "past week" }[
      this.period
    ];
    return `${magnitude}, ${period}`;
  }

  #renderQuakes(features) {
    const items = features.slice(0, this.count);
    this.#refs.list.replaceChildren();

    if (items.length === 0) {
      this.#setState("empty", `No earthquakes reported — ${this.#describeQuery()}.`);
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const feature of items) {
      const node = itemTemplate.content.cloneNode(true);
      const props = feature?.properties ?? {};

      node.querySelector(".quake-mag").textContent = formatMagnitude(props.mag);

      const place = node.querySelector(".quake-place");
      place.textContent = props.place ?? "Location not reported";
      if (isSafeEventUrl(props.url)) {
        place.setAttribute("href", props.url);
      } else {
        // An anchor with no href is not a link. Swap in plain text instead.
        const text = document.createElement("span");
        text.className = "quake-place";
        text.textContent = place.textContent;
        place.replaceWith(text);
      }

      const time = node.querySelector("time");
      const when = formatTime(props.time);
      if (when) {
        time.setAttribute("datetime", when.iso);
        time.textContent = when.label;
      } else {
        time.remove();
      }

      fragment.append(node);
    }

    this.#refs.list.append(fragment);
    this.#setState(
      "ready",
      `${items.length} ${items.length === 1 ? "earthquake" : "earthquakes"} — ${this.#describeQuery()}.`,
    );
  }

  #renderError(message) {
    this.#refs.list.replaceChildren();
    this.#setState("error", message);
  }

  /* ----------------------------- Fetching ----------------------------- */

  #cancelRequest() {
    clearTimeout(this.#timeoutId);
    this.#timeoutId = null;
    this.#request?.abort();
    this.#request = null;
  }

  async #load() {
    this.#cancelRequest();

    const url = this.feedUrl;

    const cached = readCache(url);
    if (cached) {
      this.#renderQuakes(cached);
      return;
    }

    this.#setState("loading", `Loading earthquakes — ${this.#describeQuery()}…`);

    const controller = new AbortController();
    this.#request = controller;
    this.#timedOut = false;
    this.#timeoutId = setTimeout(() => {
      this.#timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`The USGS feed responded with ${response.status}.`);
      }

      const data = await response.json();
      const features = Array.isArray(data?.features) ? data.features : [];

      // A later request or a disconnect superseded this one.
      if (controller.signal.aborted) return;

      writeCache(url, features);
      this.#renderQuakes(features);
    } catch (error) {
      if (controller.signal.aborted && !this.#timedOut) {
        // Reconfigured or removed from the document — not a failure.
        return;
      }
      this.#renderError(
        this.#timedOut
          ? "The earthquake feed took too long to respond."
          : "Could not reach the earthquake feed.",
      );
    } finally {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
      if (this.#request === controller) this.#request = null;
    }
  }
}

customElements.define("quake-feed", QuakeFeed);
