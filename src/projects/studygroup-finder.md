---
layout: layouts/project.njk
title: StudyGroup Finder
order: 3
date: 2025-06-02
description: "Case study: StudyGroup Finder, a full-stack app that matches classmates into study groups."
summary: A small full-stack app that matches classmates into study groups by course and schedule overlap.
stack: [Python, Flask, React, PostgreSQL]
image: /assets/project-gamma.png
imageAlt: Screenshot placeholder for the StudyGroup Finder project
repo: https://github.com/example/studygroup-finder
---

<section>
  <h2>Overview</h2>
  <p>Finding a study group in a 300-person lecture is a coordination problem, not a
    social one. StudyGroup Finder takes a course list and a weekly availability
    grid and proposes groups of three to five people whose free hours actually
    overlap.</p>
  <p>The matching is a greedy pass over availability bitmasks — not optimal, but it
    runs in milliseconds and the results were good enough that nobody asked for
    better.</p>
</section>

<section>
  <h2>Role and Contributions</h2>
  <ul>
    <li>Wrote the matching algorithm and the Flask API around it</li>
    <li>Designed the PostgreSQL schema for courses, availability, and group membership</li>
    <li>Built the availability grid, the one piece of UI everything else depends on</li>
  </ul>
</section>

<section>
  <h2>What I'd Change</h2>
  <p>The availability grid was a React component because I reached for React first.
    It's a grid of toggle buttons with a drag interaction; the platform handles that
    fine on its own, and dropping the dependency would have cut the bundle to
    almost nothing.</p>
</section>
