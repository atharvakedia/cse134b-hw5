/**
 * Global site data — the single source of truth for anything that would
 * otherwise be copy-pasted into every page: title, author, navigation,
 * social links, and the copyright year.
 *
 * A JavaScript data file (rather than JSON) lets the year be computed at
 * build time, so the footer never goes stale.
 */
export default {
  title: "Atharva",
  name: "Atharva — Portfolio",
  author: "Atharva",
  email: "atharva@example.com",

  // Canonical origin. Netlify sets URL on production deploys; this is the
  // fallback used for local builds and for the sitemap.
  url: process.env.URL || "https://cse134b-hw5.netlify.app",

  description:
    "Portfolio of Atharva, a computer science student who builds small, useful web tools end to end.",

  // Computed at build time so no template ever hard-codes a year.
  year: new Date().getFullYear(),

  // Primary navigation. Order here is the order rendered.
  nav: [
    { text: "Home", url: "/" },
    { text: "About", url: "/about/" },
    { text: "Projects", url: "/projects/" },
    { text: "Experience", url: "/experience/" },
    { text: "Contact", url: "/contact/" },
    { text: "Search", url: "/search/" },
  ],

  // Footer links. `icon` holds SVG path data so the markup stays declarative.
  social: [
    {
      name: "GitHub",
      url: "https://github.com/example",
      external: true,
      icon: "M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z",
    },
    {
      name: "LinkedIn",
      url: "https://linkedin.com/in/example",
      external: true,
      icon: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.71h.05c.53-.95 1.83-1.96 3.76-1.96 4.02 0 4.76 2.5 4.76 5.75V21h-4v-5.6c0-1.34-.02-3.06-1.9-3.06-1.9 0-2.19 1.45-2.19 2.96V21h-4V9Z",
    },
    {
      name: "Email",
      url: "mailto:atharva@example.com",
      external: false,
      icon: "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm.6 2L12 12.8 20.4 7H3.6Z",
    },
  ],
};
