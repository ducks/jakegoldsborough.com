---
title: "A 'Was this helpful?' button for a static blog"
date: 2026-05-16
description: "Lightweight per-post feedback without a backend, database, or comments system. Tera macro, ~25 lines of JavaScript, and one data attribute that lets GoatCounter do the actual work."
taxonomies:
  tags:
    - zola
    - blog
    - dev
---

I write a lot here. I don't have comments. I don't want comments. But I do want some signal about which posts are actually landing - not "did someone load the page" (GoatCounter already tells me that) but "did this post help someone."

So I added a small button at the bottom of every post:

> Was this helpful?
> [ Yep, this helped ]

Click it once and it swaps to a thank-you line. Click is recorded as a GoatCounter event. No login, no comment box, no thumbs down. Per-browser dedupe via localStorage so the same person can't pad the number by refreshing.

This post is how it works.

## Constraints

- The site is a static Zola build. I don't want a backend, a database, or auth.
- I already use [GoatCounter](https://www.goatcounter.com/) for analytics. I don't want a second analytics dependency.
- It has to keep working with JavaScript off, in the sense of not being broken. The widget can be inert when JS is disabled, but the page shouldn't render a button that lies about doing something.
- No thumbs down. Negative feedback without a way to discuss it is just background noise.
- Mobile-friendly. A pill-shaped button with a 44px tap target on small screens.

## The shape

Three new files plus three small edits to existing templates.

```
templates/macros/helpful.html      (new — Tera macro)
static/css/helpful.css             (new — scoped styles)
static/js/helpful.js               (new — ~25 lines)
templates/page.html                (import + render the macro)
templates/base.html                (load the JS)
static/css/style.css               (@import the CSS)
```

The whole feature is under 70 lines total.

## GoatCounter does the click

The first thing I learned reading [the GoatCounter events docs](https://www.goatcounter.com/help/events): you don't have to write a click handler. Any element with a `data-goatcounter-click` attribute gets bound automatically. The attribute's value is the event name; `data-goatcounter-title` sets a human-readable title.

So the Tera macro just stamps the button:

```jinja
{% macro widget(page) %}
  {% set slug = page.path
       | replace(from="/", to="-")
       | trim_start_matches(pat="-")
       | trim_end_matches(pat="-") %}
  {% set event_name = "helpful-" ~ slug %}
  <aside class="helpful" data-helpful-path="{{ page.path }}">
    <p class="helpful-prompt">Was this helpful?</p>
    <button
      type="button"
      class="helpful-button"
      data-helpful-action="vote"
      data-goatcounter-click="{{ event_name }}"
      data-goatcounter-title="Helpful click on {{ slug }}"
    >Yep, this helped</button>
    <p class="helpful-thanks" hidden>✓ Glad it helped</p>
  </aside>
{% endmacro widget %}
```

The slug is the post path with slashes replaced by dashes and the leading/trailing dashes trimmed. So `/blog/2026/was-this-helpful-button/` becomes `helpful-blog-2026-was-this-helpful-button`. Each post is its own row in GoatCounter's event list.

One gotcha: GoatCounter rejects event paths that start with `/` (the path doubles as the event name, and they reserve `/` as a real-path marker). If you forget to strip the leading slash, your events silently don't get recorded.

## JavaScript handles the dedupe

GoatCounter records the click. localStorage remembers it. The script only does the visual swap:

```js
(function () {
  var widget = document.querySelector('.helpful[data-helpful-path]');
  if (!widget) return;

  var path = widget.getAttribute('data-helpful-path');
  var storageKey = 'helpful:' + path;
  var button = widget.querySelector('[data-helpful-action="vote"]');
  var thanks = widget.querySelector('.helpful-thanks');

  function showThanks() {
    button.hidden = true;
    thanks.hidden = false;
  }

  try {
    if (localStorage.getItem(storageKey)) {
      showThanks();
      return;
    }
  } catch (e) {
    // Private browsing / storage disabled: continue without persistence.
  }

  button.addEventListener('click', function () {
    try {
      localStorage.setItem(storageKey, Date.now().toString());
    } catch (e) {
      // ignore
    }
    showThanks();
  });
})();
```

Twenty-five lines. No framework, no dependencies, no async, no fetch. The `try/catch` blocks around localStorage are for Safari private mode and embedded webviews, where `localStorage` throws on access rather than just being absent.

## Edge cases I thought about

**Tracker blockers.** If your readers run uBlock Origin or similar, count.js gets blocked and the click goes nowhere. The UI still swaps state, so they don't see a broken button - the dashboard just under-counts. Acceptable for a directional metric.

**localStorage disabled.** Try/catch keeps the UI working; users in this mode can vote again across reloads. Tolerable for a directional metric.

**Same person, multiple browsers.** Each browser counts once. There's no way to deduplicate without auth, and I don't want auth.

**JS disabled.** The button renders but does nothing. I'd rather show a friendly prompt that can't be acted on than hide the section entirely. If you find that offensive, a one-liner in `<noscript>` hides it.

## What I learned about GoatCounter

Three things that aren't obvious from the docs:

1. **Events show up in the same Pages view as pageviews.** I expected a separate "Events" tab. There isn't one. The events are inlined into the regular pages list, marked with their event title.

2. **The GIF response is always 200.** GoatCounter returns a 1x1 GIF for every count request, regardless of whether the hit was actually recorded. You can't tell from HTTP status alone whether your event registered. The signal is whether it shows up in the dashboard.

3. **`data-goatcounter-click` is dramatically simpler than calling `window.goatcounter.count()` manually.** First version of this widget did the manual call. Second version reads the data attribute. Same behavior, less code, less to break.

## What I'm not doing

- **No "X people found this helpful" counter.** GoatCounter's API doesn't expose per-page event counts to the client, so showing the number would require a backend. I don't care enough.

- **No reading-time gate.** I considered only showing the button after 30 seconds or 60% scroll, to filter skim-clicks. I'll add it if the noise becomes annoying. For now, every click is signal.

- **No newsletter pitch on click.** "Glad it helped - want more?" would convert better. But I don't have a newsletter, so it'd be a lie.

## Try it

There's one at the bottom of this post. If this was useful, click it.

I'll know whether the post landed because the dashboard will tell me. Not in pageviews. In `helpful-blog-2026-was-this-helpful-button`.
