+++
title = "Reverse engineering UDisc's API - Part 5 - Refactoring and Event Leaderboard"
date = 2025-07-01
[taxonomies]
tags = [ "APIs", "typescript" ]
+++

[Part 1](/blog/2025/reverse-engineering-udisc-api-part-1) |
[Part 2](/blog/2025/reverse-engineering-udisc-api-part-2) |
[Part 3](/blog/2025/reverse-engineering-udisc-api-part-3) |
[Part 4](/blog/2025/reverse-engineering-udisc-api-part-4)

<img src="https://i.kym-cdn.com/photos/images/original/002/546/187/fb1.jpg"
  alt="me after looking through the udisc .data endpoints" />

### Introduction

I am starting to feel like Charlie trying to find Pepe Silvia after staring
at these UDisc `.data` endpoints. The data goes deeper and deeper the more you
look. The way I was decoding the endpoints before was not helping.

### Original Code Structure

The first iteration of this library mostly had some utility functions that
I was repeatedly calling. Those utility functions would take the schema and the
original data array so I was constantly passing a lot of data around. The
functions would also only resolve the first level of a schema map so I had to
call each function many times to keep getting useful data.

For example:

`smartLayouts: [345, 3534, 12323, ...]`

I had a function that would resolve that array of IDs to values, but often times
those would just point to another schema map.

I had attempted a deeply recursive function earlier but ran into circular
dependency and memory issues. I needed to figure that out, because going level
by level just wasn't going to cut it anymore.

### New Code Structure - Enter Fairway Client and hydrateDeep

I wanted to really separate the concerns of this library especially because of
how the data is structured. I decided to structure the code more like a simple
ETL pipeline. I broke my code up into fetchers and formatters. I also wrote
a utility class that the formatters use. The most important of those utility
functions is `hydrateDeep`:

```
static hydrateDeep<T = unknown>(value: unknown, array: unknown[]): T {
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'number' && item in array) {
        return this.hydrateDeep(array[item], array);
      }
      return this.hydrateDeep(item, array);
    }) as T;
  }

  if (this.isSchemaMap(value)) {
    const result: Record<string, unknown> = {};
    for (const [rawKey, index] of Object.entries(value as Record<string, number>)) {
      const keyIndex = Number(rawKey.slice(1));
      const resolvedKey =
        typeof array[keyIndex] === 'string' ? (array[keyIndex] as string) : rawKey;

      result[resolvedKey] =
        typeof index === 'number' && index in array
          ? this.hydrateDeep(array[index], array)
          : index;
    }
    return result as T;
  }

  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = this.hydrateDeep(v, array);
    }
    return result as T;
  }

  return value as T;
}
```

This function takes a schema map and a raw data array from the `.data` endpoint.
It iterates over the schema map and looks for arrays of numbers or objects
with a string key starting with an underscore and a number value. If it finds
either of these, it treats them as schema maps and uses that value as an index
to find the value in the main raw data array.

The best part is that it's recursive and will call itself on any new schema map
it finds. This function has saved me so much time and digging by completely
resolving these schema maps. I'm not exactly sure what the issue was with my
first attempt but this one seems to work well.

Now, if I want to explore any new endpoints, I just need to add a new fetcher,
a new formatter, and a new method in `FairwayClient` that ties it all together.

### Event Results and Leaderboard

As an example, I will show you how I recently added a method for event data.

First, I added a new fetcher:

```
export async function fetchEventLeaderboardData(slug: string, round: number = 1): Promise<unknown[]> {
  try {
    const url = `${baseUrl}/events/${slug}/leaderboard.data?round=${round}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const json = await res.json();

    return json;
  } catch (error) {
    console.log('Fetch failed:', error);
    throw new Error(`Fetch failed ${error}`);
  }
}
```

Then, I add a formatter:

```
export function formatEventLeaderboard(data: unknown[]): EventRoundEntry[] {
  const schemaMap = FairwaySchemaMapExtractor.extract(data, 'routes/events/$slug/leaderboard');

  const eventResults: EventRoundEntry[] = FairwayUtils.hydrateDeep<EventRoundEntry[]>(schemaMap, data);

  return eventResults;
}
```

And lastly, I add a new method to the `FairwayClient` class:

```
async getEventLeaderboard(slug: string, round: number = 1): Promise<EventRoundEntry[]> {
  const data = await fetchEventLeaderboardData(slug, round);

  const event = formatEventLeaderboard(data);

  return event;
}
```

And bang, you can now get a fully hydrated event object back with data like this
for each player:

```
{
  _id: 'event_round_entry_hhfb6vstlt3dlo7ae7ddm98g',
  bagTagAfter: -5,
  cardSortOrder: 3,
  checksum: 'b1ccee0eb507b3da0295b5173e060493e8bef373d8a1edcdb2cd0c7b6bc097bd',
  courseLayoutId: 'XoWR97JmztpHhDx6w',
  currentRoundScore: 66,
  cutInfo: -5,
  division: 'GEN',
  dnfInfo: -5,
  eventCardId: 'event_card_ge9m7xt7luymsxae3y7131u5',
  eventEntryId: 'event_entry_qzh62yp68ptm2rjmly3e48r6',
  eventEntryIndex: 1,
  eventEntryState: 'active',
  eventListingId: 'event_listing_sw2dks54k0efb807wanaoayn',
  eventPoolId: 'event_pool_g4lcyok81h1duqg6alq956lv',
  eventRegistrantId: 'event_registrant_kiw140ze0qubpnfvphaeombu',
  eventRoundId: 'event_round_b3kz3lr759lo7bhdc74vg18n',
  eventScore: 66,
  flagIso: -5,
  handicap: -5,
  handicapRanking: -5,
  handicapRankingIsTie: true,
  handicapRelativeRoundScore: -5,
  handicapTiebreakPosition: -5,
  holeScores: [
    {
      type: 'complete',
      penalty: 0,
      relativeScore: 0,
      score: 3,
      throws: -5
    },
    {
      type: 'complete',
      penalty: 0,
      relativeScore: 1,
      score: 4,
      throws: -5
    },
    {
      type: 'complete',
      penalty: 0,
      relativeScore: 0,
      score: 3,
      throws: -5
    },
    {
      type: 'complete',
      penalty: 0,
      relativeScore: 2,
      score: 5,
      throws: -5
    },
    ...
  ]
}
```

### Wrapping Up


This refactor has made exploring UDisc's `.data` endpoints way more manageable.
I no longer cry when peeling back another layer of the schema onion - `hydrateDeep`
handles the recursion, and the new fetcher/formatter/client split keeps things
modular and testable.

There's still a lot of data to unpack and I feel like I've only scratched the
surface.

If anyone happens to be reading this and has any ideas or suggestions, please
open an issue or send an email to fairway-client@jakegoldsborough.com.

repo: [fairway client](https://github.com/ducks/fairway-client)

### Up Next

I'm not sure where this rabbit hole leads next -- but I'll keep diggin. Stay
tuned for a surprise!
