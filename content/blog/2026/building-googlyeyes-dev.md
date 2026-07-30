---
title: "googlyeyes.dev: I Built a Website That Looks Back"
date: 2026-07-30
description: "Upload an image, put googly eyes on it, and download an SVG whose eyes follow the cursor. A small browser-side project about vectors, unnecessary animation, and shipping the joke."
draft: true
taxonomies:
  tags:
    - javascript
    - svg
    - tools
    - oss
---

I had an app idea that had been sitting in my head for a while:

Upload an image. Put googly eyes on it. Download the result.

That was the whole idea.

Then, while talking through the first version, I realized a flat image was not
enough. If the eyes were SVG, the pupils could move. If the pupils could move,
they should follow the cursor. The thing you put eyes on should look back at
you.

So I built [googlyeyes.dev](https://googlyeyes.dev).

It runs entirely in the browser. Drop in an image, add as many pairs of eyes as
the situation calls for, move and resize them, then download either a still PNG
or an interactive SVG that keeps watching whoever opens it.

Nobody needed this. I wanted it anyway.

## The image never leaves the browser

There is no backend.

When you choose an image, the browser reads it with `FileReader` and turns it
into a data URL. That URL becomes the source of an `<image>` element inside the
editor's SVG:

```javascript
const reader = new FileReader();

reader.addEventListener('load', () => {
  const image = new Image();

  image.addEventListener('load', () => {
    artwork.setAttribute(
      'viewBox',
      `0 0 ${image.naturalWidth} ${image.naturalHeight}`
    );

    sourceImage.setAttribute('width', image.naturalWidth);
    sourceImage.setAttribute('height', image.naturalHeight);
    sourceImage.setAttribute('href', reader.result);
  });

  image.src = reader.result;
});

reader.readAsDataURL(file);
```

The raster image is embedded in the SVG, and the eyes are vector elements
drawn over it. Nothing gets uploaded, stored, resized on a server, or quietly
fed into some image API. The browser already knows how to do all of this.

That also makes the app unusually easy to host. The production build is static
HTML, CSS, and JavaScript on GitHub Pages. There is no database to migrate, no
process to keep alive, and no user data to lose.

## A googly eye is a constrained cursor

Each pair is an SVG group containing two white circles and two black circles.
The white circles stay put. The black ones want to move toward the cursor, but
only as far as the inside of the eye allows.

For each pupil, I take the vector from the center of its eye to the cursor and
cap its length:

```javascript
const dx = cursor.x - eyeCenter.x;
const dy = cursor.y - eyeCenter.y;
const distance = Math.hypot(dx, dy) || 1;
const scale = Math.min(maxTravel / distance, 1);

pupil.targetX = dx * scale;
pupil.targetY = dy * scale;
```

That gives me the target position. Moving directly to it looked too clean. The
pupils snapped around like a UI element, not a cheap plastic eye with a loose
black disc trapped inside it.

So each animation frame only covers part of the remaining distance:

```javascript
pupil.x += (pupil.targetX - pupil.x) * 0.18;
pupil.y += (pupil.targetY - pupil.y) * 0.18;
```

That `0.18` is most of the personality in the application. It gives the eyes a
small amount of lag. Move the cursor quickly and the pupils hurry after it.
Stop, and they settle into place.

This is not physically accurate googly-eye simulation. I did not model gravity,
friction, or the tiny manufacturing defects that make one pupil stick while the
other rattles freely. There is still room to innovate.

## The downloaded SVG is still alive

PNG export is the easy path. Clone the SVG, draw it onto a canvas, ask the
canvas for a PNG.

The more interesting export is the SVG itself.

When you click **Download living SVG**, the app clones the editor SVG, removes
selection outlines and editor-only classes, writes the eye geometry into data
attributes, and embeds a small script containing the same pupil-following
logic.

The result is one file. The original image is a data URL. The eyes are circles.
The behavior is a script at the bottom. Open it directly in a browser and it
keeps looking at the cursor without needing googlyeyes.dev again.

There is a catch: not every place that displays an SVG allows its embedded
scripts to run. That is a sensible security restriction. GitHub, image tags,
and various content systems may render the image while disabling the
interaction. That is why the PNG export exists, and why I call the SVG
"living" instead of pretending all SVG viewers behave the same way.

The file keeps the behavior wherever the viewer permits it. Everywhere else,
it is still a perfectly respectable picture with googly eyes on it.

## Building the editor around the joke

The rest of the app is deliberately small:

- Upload or drag in an image
- Get one pair of eyes immediately
- Drag a pair anywhere on the image
- Adjust its size, spacing, and rotation
- Add more pairs
- Remove the pair you regret
- Export SVG or PNG

The first pair appears automatically because an eye-adding application should
not make you find the eye-adding button before it does the one thing it exists
to do.

The controls sit beside the image on desktop and below it on mobile. The image
scales to fit the editor, but all eye positions live in the SVG's coordinate
system, so resizing the browser does not move them off the face, toaster, tree,
or municipal infrastructure they were carefully attached to.

There is no face detection. I considered it for about ten seconds and decided
clicking and dragging eyes onto something is most of the fun. Automatically
finding the correct place would make the result faster and the application
worse.

## The domain was harder than the app

The first name was `googlyey.es`.

It looked good written down. The `.es` finished the word. I checked the domain,
found it available, and then discovered that registering a Spanish domain came
with a surprising amount of form-filling for a website about movable pupils.

No.

`googlyeyes.dev` was also available. I bought that instead.

The site deploys through GitHub Actions to GitHub Pages. I used the
[name.com CLI I built earlier](/blog/2026/namecom-cli-in-nushell/) to add
GitHub's four apex records and the `www` CNAME:

```nu
namecom add googlyeyes.dev @ A 185.199.108.153
namecom add googlyeyes.dev @ A 185.199.109.153
namecom add googlyeyes.dev @ A 185.199.110.153
namecom add googlyeyes.dev @ A 185.199.111.153
namecom add googlyeyes.dev www CNAME ducks.github.io
```

For a few minutes, public DNS still returned name.com's parking address.
Then DNS moved to GitHub before GitHub had finished issuing the certificate,
which produced the alarming but temporary
`SSL_ERROR_UNRECOGNIZED_NAME_ALERT`.

By the time I finished checking all the records, GitHub had approved the
certificate for both the apex and `www`, HTTPS was enforced, and the site was
live.

The actual application build was the uncomplicated part. As usual, naming and
DNS found a way to make themselves the story.

## What it does not do

The app has no accounts, saved projects, sharing feed, automatic face detection,
or AI image analysis. It cannot generate a link to your creation because the
creation never leaves your machine.

I like that boundary.

It is a tool with one session and one job. Open it, vandalize an image with
eyes, keep the result, close the tab. The lack of persistence is not an
unfinished database feature. It is the privacy model and most of the
architecture.

The code is plain JavaScript and SVG with Vite handling the build. No component
framework. No canvas editor library. The production JavaScript is about 10 KB
compressed before gzip, which is already more than enough software for this
idea.

## It looked back

I recently wrote that
[software does not have to justify itself](/blog/2026/software-doesnt-have-to-justify-itself/).
This is exactly the kind of project I meant.

There is no market analysis for interactive googly-eye placement. I did not
interview users to discover whether their current image-eyeing workflow was
underserved. I had a dumb image in my head, realized the browser could make it
move, and wanted to see it happen.

Then it happened.

The first time the pupils followed my cursor across an uploaded image, the app
was done in the only sense that mattered. Everything after that was controls,
export, a domain, and enough polish to let other people make the same stupid
thing.

Try it: [googlyeyes.dev](https://googlyeyes.dev)

Source: [github.com/ducks/googlyeyes](https://github.com/ducks/googlyeyes)
