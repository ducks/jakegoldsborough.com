---
title: "isitreal.estate: Crowd-Sourced Reviews for Real Estate Listings"
date: 2026-04-18
description: "A site where people leave reviews for addresses they have actually visited, so you know before you go whether a listing is real."
taxonomies:
  tags:
    - svelte
    - self-hosting
    - oss
---

Most real estate listings lie. Not always in big ways, but enough that
anyone who has hunted for an apartment or a house knows the feeling -
you drive 40 minutes, the front yard is a dump, the photos were from
2018, the "washer/dryer included" means hookups in a damp basement,
and the agent shrugs.

There is no shared layer of truth for listings. Every renter and buyer
does the same recon work from scratch.

So I built [isitreal.estate](https://isitreal.estate) - crowd-sourced
reviews tied to physical addresses, not listings. Listings come and go.
Addresses stay.

## The Idea

Think Waze, but for house hunting.

You search an address. You see what other people found when they
visited. Photos they took. Whether the listing photos matched reality.
A rating. A date.

If the address has never been reviewed, you can be the first. After
you visit, leave a review with photos. Over time, bad actors
accumulate a visible history tied to the properties they list.

## Data Model

The anchor entity is the address, not the listing. A listing is
ephemeral - taken down, renamed, relisted with new photos. An
address has GPS coordinates and does not move.

```
addresses
  id, street, city, state, zip, country, lat, lng

reviews
  id, address_id, user_id,
  listing_accurate (yes/partially/no),
  rating (1-5), body, visited_at

review_photos
  id, review_id, filename, path

votes
  id, review_id, user_id, vote (accurate/not_accurate)
```

Reviews carry photos. Votes let readers weigh reviews by what the
community agreed was useful or not. A user's credibility score is
derived from how often their reviews align with votes over time.

## The Stack

- **Framework**: SvelteKit 5 (runes)
- **Database**: PostgreSQL
- **Auth**: Session-based, scrypt hashing
- **Maps**: Leaflet + OpenStreetMap tiles
- **Geocoding**: Nominatim (OSM, free)
- **Photos**: Disk storage, behind a configurable `UPLOAD_DIR`
- **Deployment**: NixOS on my VPS, Caddy reverse proxy, systemd

Nothing exotic. The most interesting choice was OSM + Nominatim
instead of Google Maps - no API key, no billing, no surprise bills if
someone shares the site somewhere.

## Deployment

The deploy is declarative and lives in my `pond-nix` repo. A new
curbside release builds a tarball on GitHub Actions; a NixOS service
fetches it on rebuild; systemd runs `node build`; Caddy handles TLS.

The first deploy broke for a boring but interesting reason. The
systemd unit tried to bind-mount a writable uploads directory into
the Nix store path, which is read-only. systemd refused:

```
Failed to create destination mount point node
'/nix/store/.../source/uploads':
Read-only file system
```

Rather than patching the Nix module to copy the app out of the store,
I made the upload directory configurable in the app itself:

```ts
export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
```

Both the write path (`src/lib/photos.ts`) and the read path
(`src/routes/uploads/[...path]/+server.ts`) import the same constant,
so they never drift. In dev it defaults to `./uploads`. In production
the systemd unit sets `UPLOAD_DIR=/var/lib/curbside/uploads` and the
BindPaths goes away entirely.

Cleaner than fighting the Nix store. And it unblocks moving uploads
off the VPS to R2 later with the same interface.

## What Works

- Signup, login, session auth
- Address search with geocoding
- Address detail page with reviews, photos, stats
- Review submission with photo uploads
- Accurate / not-accurate voting
- User profile pages
- Admin role for moderation

## What Doesn't (Yet)

- Map view on the homepage is basic
- No autocomplete on address search yet
- Photo storage lives on the VPS; needs to move to object storage
- No rate limiting on review creation
- Credibility scoring is naive

## Reflections

The technical work was the easy part. SvelteKit + Postgres + systemd
is well-trodden ground. The real question is whether enough people
will leave reviews to reach the tipping point where the site is
actually useful when you search an address.

That is the honest problem with any crowd-sourced trust network. It is
worthless until it crosses some critical mass, and valuable after. The
middle is long and quiet.

So I am seeding with real reviews of real addresses I know, and
opening it up to see what happens. If you have ever been burned by a
fake listing, leave a review.

## Links

- [isitreal.estate](https://isitreal.estate)
- [curbside (app source)](https://github.com/ducks/isitreal.estate)
- [pond-nix (deploy config)](https://github.com/ducks/pond-nix)
