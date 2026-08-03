/**
 * Removes the prebuilt Pagefind UI bundles from the build output.
 *
 * This site drives Pagefind through its JavaScript API (js/site-search.js) and
 * styles the results itself, so the shipped UI components are never loaded.
 * Emitting roughly 300 KB of unreachable third-party JavaScript and CSS would
 * work against keeping the generated output lean.
 *
 * The search engine itself — pagefind.js, the worker, the WebAssembly module,
 * and the index and fragment directories — is untouched.
 */
import { rm } from "node:fs/promises";
import path from "node:path";

const PAGEFIND_DIR = path.join("_site", "pagefind");

const UNUSED = [
  "pagefind-ui.js",
  "pagefind-ui.css",
  "pagefind-modular-ui.js",
  "pagefind-modular-ui.css",
  "pagefind-component-ui.js",
  "pagefind-component-ui.css",
  "pagefind-highlight.js",
];

let removed = 0;
for (const file of UNUSED) {
  try {
    await rm(path.join(PAGEFIND_DIR, file), { force: true });
    removed += 1;
  } catch {
    // The file list tracks Pagefind's output; a missing entry is not a failure.
  }
}

console.log(`[prune-pagefind-ui] removed ${removed} unused Pagefind UI files`);
