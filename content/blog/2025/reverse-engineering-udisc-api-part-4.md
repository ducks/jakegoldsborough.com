+++
title = "Reverse engineering UDisc's API - Part 4 - SmartLayouts - Hole Details, Tees, and Targets"
date = 2025-06-09
[taxonomies]
tags = [ "APIs", "typescript" ]
+++

[Part 1](/blog/2025/reverse-engineering-udisc-api-part-1) |
[Part 2](/blog/2025/reverse-engineering-udisc-api-part-2) |
[Part 3](/blog/2025/reverse-engineering-udisc-api-part-3)

In previous parts of this series, we explored how UDisc structures its course and
detail data using schema maps and densely packed JSON arrays. Now we’re going a
level deeper — into the `smartLayouts` array and the rich, interconnected
structure that defines each `hole` in a layout.

#### What is a `SmartLayout`

In UDisc, a `smartLayout` is a curated list of hole configurations —
representing a specific way to play the course, like a tournament layout, long
tees, or winter alt positions.

Each course will have a `smartLayouts` field that is an array of ID. Each ID
points to a layout configuration with specific hole details.

`smartLayouts: [345, 3534, 12323, ...]`

#### Resolve `SmartLayout` objects

We can resolve the layout entries using our `resolveByIds` utility, passing in
the smart layout schema map and data array.

`const layouts = resolveByIds(layoutMap, data);`

Each layout will includes fields like `name`, `holes`, and various other layout
details.

```
{
  _id: '2daCeAPCLnsEQKntM',
  layoutId: 106061,
  courseId: 1523,
  type: 'smart',
  name: 'Glitch World Championship Qualifer',
  details: 'Layout for the Glitch World Championship Qualifier on 6/1/2025!',
  status: 'active',
  holes: [
    22549, 22566, 22583,
    22599, 22619, 22641,
    22658, 22674, 22691,
    22707, 23074, 23088,
    23867, 23886, 24225,
    24244, 24675, 24692
  ],
  sortIndex: 1998146,
  areLayoutSelectionsValid: true,
  playCount30: 15,
  lengthBin: 'intermediate',
  typicalHoleLengthLowerMeters: 66.925,
  typicalHoleLengthUpperMeters: 124.263,
  floorsAscended: 17,
  floorsDescended: 21,
  stepCount: 4797,
  time: 130.71908333333334,
  parRoundRating: 182.73106384277344,
  activationDate: undefined,
  deactivationDate: undefined,
  level: undefined,
  difficultyBin: 'intermediate',
  technicalityBin: 'technical',
  holeDistance: { _398: 24717, _400: 24718 }
}
```

#### Resolve Holes

Now it's time to figure out more about each hole.

First, we have to follow the `holes` field which is an array of IDs.

Similar to above, we use `resolveByIds`:

`const holesSchema = resolveByIds(holes, data);`

That will gives us an array of objects that turns out to be, you guessed it, a
schema map.

```
[
  {
    _352: 353,
    _354: 4133,
    _72: 356,
    _357: 19527,
    _374: 19532,
    _385: 19538,
    _387: 388,
    _389: 4146,
    _147: 256,
    _366: 7,
    _1627: 131,
    _1628: 7,
    _707: 19539,
    _367: -5,
    _368: 19721,
    _393: 19722,
    _159: 19723,
    _396: 19724
  },
  ...
]
```

We can now take this, iterate over it, and resolve each object of IDs:

```
holesSchema.forEach((schema) => {
  holesDecoded.push(resolveKeyAndValueNames(schema, data));
});
```

And we finally get to see some hole data:

```
[
  {
    holeId: 'KRFy',
    pathConfigurationId: 'qXAC',
    name: '1',
    status: 'active',
    teePosition: {
      _359: 360,
      _294: 22551,
      _147: 256,
      _149: 362,
      _152: 363,
      _186: 22552,
      _366: 7,
      _367: 21,
      _368: 22554
    },
    targetPosition: {
      _376: 377,
      _158: 22556,
      _147: 256,
      _149: 380,
      _152: 381,
      _223: 22558,
      _366: 7
    },
    doglegs: [],
    par: 3,
    distance: 80.749,
    description: '',
    isTemporary: false,
    notes: 'OB: Pond (defined by white stakes). Play, with a one stroke penalty, from last place disc was in bounds or re-tee.',
    teeSign: { _370: 371, _372: 373 },
    teePad: { _149: 362, _152: 363 },
    basket: { _149: 380, _152: 381 },
    holeDistance: { _398: 399, _400: 390 }
  },
  {
    holeId: 'L43O',
    pathConfigurationId: 'zwYI',
    name: '2',
    status: 'active',
    teePosition: {
      _359: 406,
      _294: 22568,
      _147: 256,
      _149: 409,
      _152: 410,
      _186: 22569,
      _366: 7
    },
    targetPosition: {
      _376: 415,
      _158: 22573,
      _147: 256,
      _149: 418,
      _152: 419,
      _223: 22575,
      _366: 7
    },
    doglegs: [],
    par: 3,
    distance: 70.07600000000001,
    notes: undefined,
    teeSign: undefined,
    teePad: { _149: 409, _152: 410 },
    basket: { _149: 418, _152: 419 },
    holeDistance: { _398: 429, _400: 425 }
  },
  ...
]
```

#### Introducing `deepHydrate`

```
export function deepHydrate<T>(input: T, data: unknown[]): T {
  if (Array.isArray(input)) {
    return input.map(item => deepHydrate(item, data)) as T;
  }

  if (typeof input !== 'object' || input === null) return input;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isSchemaMap(value)) {
      result[key] = resolveKeyAndValueNames(value, data);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v =>
        isSchemaMap(v) ? resolveKeyAndValueNames(v, data) : deepHydrate(v, data)
      );
    } else {
      result[key] = deepHydrate(value, data);
    }
  }

  return result as T;
}
```

The `deepHydrate` function recursively walks through any input object (or array)
and resolves all embedded schema maps into human-readable objects using
`resolveKeyAndValueNames`.

One caveat: `deepHydrate` only resolves schema maps found in the original
structure. If a resolved field itself contains a new schema map, that won't be
resolved unless you hydrate it separately or extend the function recursively.

Calling this function on each hole will show you what I mean:

```
{
  holeId: 'KRFy',
  pathConfigurationId: 'qXAC',
  name: '1',
  status: 'active',
  teePosition: {
    teePositionId: 'XMhc',
    teeType: { _292: 293, _147: 256, _294: 295 },
    status: 'active',
    latitude: 42.2765401,
    longitude: -71.896142,
    teePositionLabels: [ 22553 ],
    isTemporary: false,
    notes: '',
    teeSign: { _370: 371, _372: 373 }
  },
  targetPosition: {
    targetPositionId: 'PQ1G',
    targetType: {
      _254: 255,
      _147: 256,
      _104: 159,
      _72: 193,
      _257: 22557,
      _194: 195
    },
    status: 'active',
    latitude: 42.2770589,
    longitude: -71.8968277,
    targetPositionLabels: [ 22559, 22560 ],
    isTemporary: false
  },
  doglegs: {},
  par: 3,
  distance: 80.749,
  description: '',
  isTemporary: false,
  notes: 'OB: Pond (defined by white stakes). Play, with a one stroke penalty, from last place disc was in bounds or re-tee.',
  teeSign: {
    imageUrl: 'https://udisc-parse.s3.amazonaws.com/league/c9f63559-3322-46c5-aedb-9bd8211e03c0_Red1.png',
    optimizedUrl: 'https://udisc-parse.s3.amazonaws.com/r_c9f63559-3322-46c5-aedb-9bd8211e03c0_Red1.png'
  },
  teePad: { latitude: 42.2765401, longitude: -71.896142 },
  basket: { latitude: 42.2770589, longitude: -71.8968277 },
  holeDistance: { feet: 264.92454915999997, meters: 80.749 }
}
```

You can see the fields like `teePosition` and `targetPosition` have been resolved
but since they also contained schema maps, there are still unresolved fields.

I am working on updating `deepHydrate` to walk new schema maps it finds
but that will be for another post.

We are getting into some really cool data now. You could come up with some neat
map visualizations using the longitude and latitude. Maybe you want to find
the average distance for holes on the Disc Golf Pro Tour and figure out how
many holes Forrest Gump would have played. The possibilities are endless.

#### Summary

In this post, we dug into how UDisc represents hole layouts using the
smartLayouts structure. We walk through resolving layout metadata, decoding
individual holes with schema maps, and using deepHydrate to unpack nested
fields. It gets us most of the way there — tees, targets, distances, etc. — but
we also run into a limit: deepHydrate only resolves the first layer. If the
resolved fields themselves contain schema maps, those stay untouched (for now).

This post highlights how deeply structured and graph-like the data really is —
and sets up where we're headed next with full hydration and maybe even some
event/live scoring stuff.
