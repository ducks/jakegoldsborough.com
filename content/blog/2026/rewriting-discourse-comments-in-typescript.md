---
title: "Rewriting discourse-comments in TypeScript: Dropping WASM for a 97% Smaller Bundle"
date: 2026-02-27
description: "I rewrote the Discourse embedded comments API client from
Rust/WASM to pure TypeScript. The bundle went from 742 KB to 18 KB."
taxonomies:
  tags:
    - discourse
    - typescript
    - oss
---

Last month I wrote about building an
[embedded comment widget](/blog/2026/building-discourse-embedded-comments/)
for Discourse using Rust compiled to WebAssembly. It worked. Users
could drop a single script tag on their page and get comments from
a Discourse topic.

But the bundle was 742 KB. Most of that was WASM.

I rewrote the API client in TypeScript and the bundle dropped to
18.5 KB. Same functionality, same API surface, no WASM runtime.

## Why Rewrite?

The original stack had three layers: a Rust HTTP client compiled to
WASM, a TypeScript web component, and an esbuild plugin to inline
the WASM binary as base64. That last part was the real cost. The
WASM binary was ~546 KB, and base64 encoding inflates that by 33%.

The Rust client existed because I wanted to push Rust into the
browser. It was a fun experiment. But the API client itself was
straightforward HTTP: build a URL, set some headers, parse JSON.
There's nothing in that workflow that benefits from Rust's type
system or performance characteristics. The browser's native `fetch`
does the same thing.

So I asked the obvious question: what if the API client was just
TypeScript?

## The Rewrite

The new client is
[discourse-api-ts](https://github.com/ducks/discourse-api-ts). Zero
runtime dependencies. It uses `fetch` for HTTP, which every modern
browser and Node.js already provides.

The Rust client had 18 methods across topics, posts, categories,
chat, notifications, and likes. The TypeScript port has the same 18
methods with identical signatures. The only difference is `BigInt`
parameters became regular `number` (JavaScript's `Number` handles
Discourse IDs fine).

Here's what the client looks like:

```typescript
// Anonymous (read-only)
const client = new DiscourseClient("https://forum.example.com");

// Authenticated
const client = DiscourseClient.withUserApiKey(
  "https://forum.example.com",
  storedApiKey
);

const topic = await client.getTopic(123);
await client.createPost(123, "Hello from the widget");
await client.likePost(456);
```

No `init()` call to load the WASM runtime. No `BigInt()` wrappers.
Just regular async functions.

## Updating discourse-comments

With the new client published to npm, updating the web component
was mostly find-and-replace:

- `import init, { WasmDiscourseClient }` became
  `import { DiscourseClient }`
- Removed the `await init()` call in `loadComments`
- `BigInt(this.topicId)` became `Number(this.topicId)`
- Deleted the esbuild WASM inlining plugin entirely

The build script went from 60 lines of WASM gymnastics to a
straightforward esbuild call:

```javascript
await esbuild.build({
  entryPoints: ["src/discourse-comments.ts"],
  bundle: true,
  format: "iife",
  outfile: "dist/discourse-comments.min.js",
  minify: true,
});
```

No custom plugins. No base64 encoding. No `WebAssembly.instantiate`.

## The Numbers

| | Rust/WASM | TypeScript |
|---|---|---|
| Bundle size (minified) | 742 KB | 18.5 KB |
| Runtime dependencies | wasm-bindgen | None |
| Build steps | cargo build + wasm-pack + tsc + esbuild | tsc + esbuild |
| Init overhead | WASM decode + instantiate | None |

That 18.5 KB includes the entire web component, all the styles, the
OAuth flow, and the API client. A user on a slow connection
downloads 40x less data.

## Dev Experience

With the Rust client, the build pipeline was: cargo build targeting
wasm32, wasm-pack to generate JS bindings, TypeScript compilation,
then esbuild with a custom plugin to inline the binary. If any step
failed, the error could be in Rust, in wasm-bindgen, in the
TypeScript types, or in the bundler plugin. Debugging meant jumping
between ecosystems.

With TypeScript, it's `tsc && node build.mjs`. If there's a type
error, it's in TypeScript. If there's a runtime error, it's in
JavaScript. One language, one toolchain, one set of error messages.

Adding a new API method in Rust meant: define the struct, implement
the method, rebuild WASM, regenerate bindings, update TypeScript
types to match. In TypeScript: add an interface, add a method, done.
I added search, user profiles, and topic management (6 new methods)
in one sitting.

## What I Lost

Honesty requires noting what the WASM version had going for it.

Rust's type system caught entire categories of errors at compile
time. The TypeScript version uses interfaces, which help, but
they're structural and optional. A `Post` with a missing field
compiles fine until it blows up at runtime.

Rust's `Result` type forced explicit error handling everywhere. In
TypeScript, it's easy to forget a `.catch()` or let an error
propagate silently.

For this particular project, those trade-offs don't matter much. The
API surface is small and the error handling is straightforward. But
for a larger client library, I'd think harder about it.

## When WASM Makes Sense

WASM is the right call when you need computation that JavaScript
can't do efficiently: image processing, cryptography, physics
simulations, codecs. If you're doing heavy lifting in a tight loop,
WASM's predictable performance model wins.

But for HTTP clients that serialize JSON and build URLs, the browser
already has everything you need. Adding a WASM layer for that is
carrying a backpack full of bricks on a walk to the mailbox.

## Try It

The widget still works the same way. Drop it on a page, point it
at a Discourse topic, get comments. It's just 40x lighter now.

```html
<script src="discourse-comments.min.js"></script>
<discourse-comments
  discourse-url="https://forum.example.com"
  topic-id="123">
</discourse-comments>
```

- [discourse-comments](https://github.com/ducks/discourse-comments)
- [discourse-api-ts](https://github.com/ducks/discourse-api-ts)
