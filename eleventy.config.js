/**
 * Eleventy configuration.
 *
 * Source lives in src/ and is generated into _site/, which is gitignored —
 * Netlify runs this build on every push rather than receiving uploaded output.
 */
export default function (eleventyConfig) {
  // Static assets are copied through untouched. Everything else is templated.
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/assets");

  // Editing CSS or JS should reload the dev server even though they are passthrough.
  eleventyConfig.addWatchTarget("src/css/");
  eleventyConfig.addWatchTarget("src/js/");

  /** ISO date (YYYY-MM-DD) for <time datetime> and sitemap <lastmod>. */
  eleventyConfig.addFilter("isoDate", (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
  });

  /** Human-readable date for page bylines. */
  eleventyConfig.addFilter("readableDate", (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  });

  /**
   * Absolute URL for canonical links and the sitemap.
   * Netlify exposes the deploy URL as an env var; site.url is the fallback.
   */
  eleventyConfig.addFilter("absoluteUrl", (path, base) => {
    return new URL(path, base).href;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    // Markdown case studies get front matter and Nunjucks in their bodies.
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
}
