---
title: "Building Slumprutt: A Random Route Generator in Under an Hour"
date: 2025-10-16
description: "Built a complete random route generator app with TypeScript, Svelte, and OSRM to find new walking and cycling routes in my neighborhood."
---

I've wanted a random route generator for awhile now. My problem is I walk
and bike the same routes over and over. My brain goes on autopilot. I wanted
something that would throw me new routes to explore in my own neighborhood.

I wanted something simple: "Give me a random 5-mile loop from my house."

So I built it. With Claude Code's help, we went from idea to working app
in under an hour.

## The Name

"Slumprutt" comes from Swedish "slumpmässig rutt" (slumpmässig = random or
by chance, rutt = route), commonly shortened to just "slumprutt". Seemed
fitting for a random route generator.

## The Stack

**Backend**: TypeScript + Node.js + Express

**Frontend**: Svelte + TypeScript + Leaflet

**Routing**: OSRM (Open Source Routing Machine)

**Maps**: OpenStreetMap

OSRM deserves special mention. It's a free public API that provides
road-accurate routing with turn-by-turn directions. Incredibly fast
(sub-second response times) and requires zero setup. Just hit their public
endpoint and get back real routes that follow actual roads.

## The Algorithm

The core challenge was generating interesting random loops. Not just random
waypoints, but routes that actually feel like purposeful walks or bike rides.

Here's what I landed on:

```typescript
export function generateLoopWaypoints(
  start: Coordinate,
  targetDistanceKm: number,
  variationIndex: number = 0
): Coordinate[] {
  // Use fewer waypoints (3-5) for longer segments
  const numWaypoints = Math.max(3, Math.min(5, 3 + variationIndex));

  // Reduced multiplier to 0.6 to account for road routing overhead
  const baseRadius = targetDistanceKm / (2 * Math.PI) * 0.6;

  const waypoints: Coordinate[] = [];
  const latPerKm = 1 / 111; // 1 degree latitude ≈ 111km
  const lonPerKm = 1 / (111 * Math.cos((start.lat * Math.PI) / 180));

  // Rotate each route by 120° to avoid overlap
  const primaryDirection = (variationIndex * (2 * Math.PI)) / 3;

  for (let i = 0; i < numWaypoints; i++) {
    const baseAngle = (i / numWaypoints) * 2 * Math.PI + primaryDirection;
    // More randomness for diverse paths
    const angleVariation = (Math.random() - 0.5) * 0.8;
    const angle = baseAngle + angleVariation;
    // More radius variation to explore different distances
    const radiusVariation = 0.5 + Math.random() * 1.0;
    const radius = baseRadius * radiusVariation;

    waypoints.push({
      lat: start.lat + Math.sin(angle) * radius * latPerKm,
      lon: start.lon + Math.cos(angle) * radius * lonPerKm,
    });
  }

  return waypoints;
}
```

Key design decisions:

1. **Fewer waypoints** (3-5 instead of 8+) means longer road segments and
   more interesting routes. Too many waypoints and you just walk back and
   forth.

2. **Smaller radius with overhead adjustment** (0.6x) accounts for the fact
   that road routing adds significant distance compared to straight-line
   waypoints. Initially used 1.5x which resulted in 7-8 mile routes when
   requesting 1 mile.

3. **Directional rotation** (120° per route) prevents all routes from
   heading in the same direction. Generate 3 routes and they'll spread out
   into different quadrants.

4. **More randomness** (0.8 angle variation, 0.5-1.5 radius variation)
   creates diverse paths that explore different areas. This prevents
   multiple routes from clustering in the same locations.

Then we feed those waypoints to OSRM, which turns them into actual road
routes with turn-by-turn directions.

## Challenges

### Distance Input Validation

First issue: weird validation errors when changing distance inputs. I had
`step="0.1"` on both the miles and kilometers inputs. The problem:
3.2 miles converts to 5.1494888 km, which rounds to 5.15. The browser
expected 5.1 or 5.2 (multiples of 0.1) and rejected 5.15.

Fix: `step="any"` accepts any decimal value.

### Map Not Visible

Built the whole UI, ran it, and... no map. Just an empty space where the
map should be.

The issue: CSS height inheritance. The map div had `height: 100%` but its
parent containers didn't have explicit heights. The fix required setting
height on three elements:

```css
:global(html),
:global(body),
:global(#app) {
  height: 100%;
  width: 100%;
}
```

This is a common Svelte gotcha when you want a full-viewport layout.

### Routes Don't Follow Roads

Initial implementation drew straight lines between waypoints. Routes went
through buildings, parks, water. Not useful for actual navigation.

This is where OSRM saved the day. One API call with waypoints, get back
actual road geometry:

```typescript
const coords = route.points.map(p => `${p.lon},${p.lat}`).join(';');
const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true`;

const response = await fetch(url);
const data = await response.json();
```

The `steps=true` parameter gives you turn-by-turn directions too, which
I added to the UI in collapsible sections under each route.

### Boring Back-and-Forth Routes

First test: "Walk this way, turn around, walk back." Technically a loop, but
boring as hell.

The issue was too many waypoints creating short segments. The fix was the
algorithm changes I mentioned earlier: fewer waypoints, larger radius,
directional rotation. Now routes actually explore different areas instead
of just oscillating.

## TypeScript Across the Stack

I initially questioned whether TypeScript was overkill for this project.
Turns out it was perfect.

Shared types between frontend and backend caught so many potential bugs:

```typescript
export interface Coordinate {
  lat: number;
  lon: number;
}

export interface GeneratedRoute {
  id: number;
  points: Coordinate[];
  waypoints: Coordinate[];
  isLoop: boolean;
  distance?: number;
  duration?: number;
  steps?: RouteStep[];
}
```

When the backend returns `GeneratedRoute[]`, the frontend knows exactly
what shape to expect. No guessing, no runtime surprises.

## Development Environment

Created a Nix shell for reproducible development:

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    typescript
    nodePackages.tsx
  ];
}
```

Anyone can clone the repo, run `nix-shell`, and have the exact same
environment. No "works on my machine" issues.

## Result

The app works. You enter an address, pick a mode (walk/bike/car), set a
distance, and hit generate. It shows you multiple random routes on an
interactive map with turn-by-turn directions.

![Initial interface with form inputs](/images/slumprutt-1.png)

![Generated routes displayed on map](/images/slumprutt-2.png)

![Route highlighting on hover](/images/slumprutt-3.png)

![Turn-by-turn walking directions](/images/slumprutt-4.png)

I've already used it to find new walking routes in my neighborhood.

Is it perfect? No, it's not. You will get routes that go down sketchy roads or
routes that still go back and forth. But it was fun and it's helpful to me.

**Try it yourself**: [github.com/ducks/slumprutt](https://github.com/ducks/slumprutt)

## What I Learned

1. **OSRM is incredible** - Free, fast, accurate. No API key required. If
   you're building anything with routing, use OSRM.

2. **TypeScript prevents so many bugs** - Especially for coordinate/route
   data that flows through multiple layers. Type errors at compile time
   beat runtime errors every time.

3. **Fewer waypoints make better routes** - Counterintuitive, but 3-5
   waypoints create more interesting loops than 8-10.

4. **Svelte's reactivity is clean** - No useState/useEffect boilerplate.
   Just `$: if (condition) { doThing() }` and it works.

5. **Building with AI is wild** - Went from idea to working app in under
   an hour. Not just scaffolding, but a fully functional app with an
   interesting algorithm, API integration, and polished UI.
