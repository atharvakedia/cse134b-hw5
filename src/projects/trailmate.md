---
title: TrailMate
order: 1
date: 2025-11-04
description: "Case study: TrailMate, a hiking-trail logging web app with route history and personal notes."
summary: A hiking-trail logging web app with route history, notes, and basic stats, built solo end to end.
stack: [JavaScript, Node.js, Express, MongoDB]
image: /assets/project-alpha.png
imageAlt: Screenshot placeholder for the TrailMate project
repo: https://github.com/example/trailmate
---

<section>
  <h2>Overview</h2>
  <p>TrailMate is a small web app for logging hikes: route, distance, and a couple
    of freeform notes per trip, so I'd stop losing that information in random text
    files.</p>
  <p>The <em>hardest</em> part wasn't the CRUD itself — it was designing a data
    model flexible enough for very different kinds of trails without turning the
    log form into a novel.</p>
</section>

<section>
  <h2>Role and Contributions</h2>
  <ul>
    <li>Designed the data model and REST API (Node.js/Express, MongoDB)</li>
    <li>Built the entire front end, including the trail log form and history view</li>
    <li>Wrote the deployment config and set up the hosting environment</li>
  </ul>
</section>

<section>
  <h2>What I'd Change</h2>
  <p>The note field started as a single textarea and stayed that way far too long.
    Splitting it into structured fields — conditions, companions, gear — would have
    made the history view searchable instead of just readable.</p>
</section>
