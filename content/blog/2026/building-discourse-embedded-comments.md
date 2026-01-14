---
title: "Building Embedded Discourse Comments with Rust and WASM"
date: 2026-01-14
description: "An experiment in creating a drop-in comment widget for static
sites using Rust compiled to WebAssembly, talking to Discourse's REST API."
taxonomies:
  tags:
    - discourse
    - rust
    - wasm
    - oss
---

I built an embedded comment widget that lets you add Discourse-powered comments
to any static site with a single script tag. No iframe, no build step, just
drop it in and it works.

```html
<script src="https://unpkg.com/discourse-comments/dist/discourse-comments.min.js"></script>
<discourse-comments
  discourse-url="https://forum.example.com"
  topic-id="123">
</discourse-comments>
```

The widget fetches comments from a Discourse topic, renders them with a clean
UI, and lets authenticated users post replies and like posts. All in a 725KB
bundle with the WASM runtime inlined.

You can see the code here:
[discourse-comments on GitHub](https://github.com/ducks/discourse-comments)

## Why Build This?

Discourse has had an embedding feature for years, but it uses iframes. Iframes
work, but they come with baggage: height management issues, styling isolation,
auth cookie problems, SEO invisibility, accessibility complications. It's 2026
and we have web components, Shadow DOM, and ES modules. We can do better.

I wanted to see if a standalone component talking directly to Discourse's REST
API could provide a cleaner experience. And I wanted an excuse to push some
Rust into the browser.

## The Stack

The widget is built in three layers:

1. **[discourse-api-rs](https://github.com/ducks/discourse-api-rs)** - A Rust
   client library for Discourse's API, compiled to WASM with wasm-bindgen
2. **[discourse-comments](https://github.com/ducks/discourse-comments)** - A
   TypeScript web component that uses the WASM client
3. **esbuild bundler** - Inlines the WASM as base64 so the whole thing is a
   single file

The Rust layer handles HTTP requests, JSON parsing, and the OAuth flow. The
TypeScript layer handles DOM rendering and user interactions. The bundler
glues it together into a drop-in script.

## The Hard Part: OAuth

Getting read-only comments working was straightforward. The Discourse API is
well-documented and predictable. But letting users post comments required
authentication.

Discourse supports User API Keys, which are perfect for third-party clients.
The flow works like this:

1. Generate an RSA key pair in the browser
2. Redirect to Discourse with the public key
3. User approves the app
4. Discourse encrypts an API key with the public key
5. Redirect back with the encrypted payload
6. Decrypt the payload with the private key
7. Store the API key for future requests

Sounds simple but there were issues.

### The Base64 Whitespace Problem

Discourse returns the encrypted payload as base64 in a query parameter. My
code called `atob(payload)` to decode it.

Problem: Discourse includes newlines in the base64 encoding. `atob()` chokes
on whitespace.

Fix: Strip whitespace first: `payload.replace(/\s/g, '')`.

### The RSA Padding Problem

WebCrypto only supports RSA-OAEP for encryption/decryption. Discourse
historically used PKCS1 padding, which WebCrypto can't handle.

Turns out Discourse added OAEP support in December 2025 (PR #36592). You pass
`padding=oaep` in the OAuth request and it encrypts with OAEP instead. But if
your Discourse instance is older than that, you're stuck.

This one cost me hours of debugging before I found the version requirement.

## The Like Button

Once posting worked, adding likes was straightforward. The Discourse API has
`POST /post_actions` to like and `DELETE /post_actions/:id` to unlike.

The UI shows a heart icon that toggles between outline (not liked) and filled
(liked). Clicking it calls the API and updates the count. Nothing fancy, but
it makes the widget feel more interactive.

One gotcha: you can't like your own posts. Discourse returns 403. I added a
check to hide the like button on posts where `yours: true`.

## The Bundle

Getting this to work as a single script tag required some bundler gymnastics.
The WASM client needs its binary loaded somehow. Options:

1. Fetch it from a URL at runtime (requires hosting the .wasm file)
2. Inline it as base64 in the JavaScript bundle

I went with option 2. The esbuild plugin intercepts the WASM import, reads the
binary, base64-encodes it, and injects code that decodes and instantiates it
at runtime.

```javascript
const wasmBuffer = fs.readFileSync(wasmPath);
const wasmBase64 = wasmBuffer.toString('base64');

// In the bundle:
const bytes = Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0));
await WebAssembly.instantiate(bytes, imports);
```

This adds ~500KB to the bundle (the WASM binary), but eliminates the need for
any separate file hosting. One script tag, everything works.

## The Community Response

I shared this experiment internally. The response was encouraging but also
clarifying. Some on the core team pushed back on the WASM approach, preferring
to stay within the existing Ember/Rails stack. Ember recently added support for
rendering components to a DOM without spinning up an entire application
instance, which could serve the same use case without introducing a new
runtime.

I get it. Maintaining a Rust/WASM layer alongside an existing codebase adds
complexity. But an "ever moving API target" concern feels overstated. This is
a REST API with stable endpoints for fetching topics, creating posts, and
liking. Compare that to AI integrations that build on LLM APIs from multiple
vendors with breaking changes every few months.

The iframe suggestion also came up. That feels like a step backward. We have
better tools now.

## What I Learned

**WASM is production-ready.** The toolchain (wasm-pack, wasm-bindgen) just
works. Cross-compiling Rust to run in browsers isn't experimental anymore.

**OAuth in the browser is tricky.** The combination of cross-origin redirects,
browser storage limitations, and encryption requirements creates a lot of edge
cases. Test with real redirects, not just mocked flows.

**Experiments spark conversations.** Even if the official team goes a
different direction, building a working prototype moved the discussion
forward. Sometimes the value of an experiment is proving that a use case
matters, not necessarily that your implementation is the right one.

## Try It

The widget works today with any Discourse instance running December 2025 or
later (for the OAEP OAuth support).

- [discourse-comments on GitHub](https://github.com/ducks/discourse-comments)
- [discourse-api-rs on GitHub](https://github.com/ducks/discourse-api-rs)
- [npm package](https://www.npmjs.com/package/discourse-comments)
