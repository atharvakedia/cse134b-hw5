---
title: PixelSort Visualizer
order: 2
date: 2025-09-18
description: "Case study: PixelSort Visualizer, a Canvas app that animates sorting algorithms step by step."
summary: A Canvas-based visualizer that animates sorting algorithms — bubble, merge, and quick — one comparison at a time.
stack: [HTML5 Canvas, Vanilla JS]
image: /assets/project-beta.png
imageAlt: Screenshot placeholder for the PixelSort Visualizer project
repo: https://github.com/example/pixelsort-visualizer
---

<section>
  <h2>Overview</h2>
  <p>PixelSort renders an array as a bar chart on a <code>&lt;canvas&gt;</code> and
    animates each comparison and swap, so the difference between an O(n²) and an
    O(n log n) sort is something you watch rather than something you're told.</p>
  <p>Everything is plain JavaScript. No animation library, no framework — just
    <code>requestAnimationFrame</code> and a generator function per algorithm.</p>
</section>

<section>
  <h2>Role and Contributions</h2>
  <ul>
    <li>Implemented bubble, merge, and quick sort as pausable generators</li>
    <li>Built the Canvas renderer and the speed and array-size controls</li>
    <li>Added keyboard controls so the visualization is operable without a mouse</li>
  </ul>
</section>

<section>
  <h2>What I'd Change</h2>
  <p>Driving the animation from generators was the right call — it made pause and
    step-forward nearly free. Rendering, though, redraws the whole canvas every
    frame; only the two bars that changed actually need repainting.</p>
</section>
