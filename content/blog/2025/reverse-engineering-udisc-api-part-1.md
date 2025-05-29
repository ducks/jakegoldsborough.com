+++
title = "Reverse Engineering UDisc's API - Part 1, Courses"
date = 2025-05-28
[taxonomies]
tags = [ "APIs", "typescript" ]
+++

I am a very avid fan and player of disc golf.

Disc golf is basically the rules of golf but you're throwing a frisbee
instead of hitting a ball. There are differences of course. We don't throw
the disc into a hole in the ground, but the basic idea of starting in one place
and getting an object to another remains the same. It's a beautiful sport that
combines the mystique of physics and flight with the beauty and tranquility of
nature. I get to take a hike and throw stuff through the woods, what's not to
love? Like golf, there is a scoring system, and that's where UDisc comes in.

UDisc is a great site, app, and company who makes the go-to disc golf scoring
app. You can search for courses, find leagues, and most importantly, keep score.
It's a fantastic tool with one problem - there is no public API. I have seen this
asked for publicly but UDisc has shown no plans for this in the
immediate future, that's where I come in. I really like figuring out how things
work.

#### Starting small

This is the first real API I've tried reverse engineering so I wanted to start
small. Some of the features of UDisc are paid and only available in the app and
I didn't want to dive into that just yet. There are parts of the service that
are available on the website so I wanted to start there.


#### Courses
The biggest feature of the free version of the app is probably the course
directory so that's where I started.

[https://udisc.com/courses](https://udisc.com/courses)

Going directly to the courses URL, you can use the Developer Tools and the
Network tab to already find some useful calls. The most important is a call
to `/__manifest`. This seems to strongly suggest at least the site is a Remix
Run based app, also indidcated by the `p` parameters.

[https://remix.run/](https://remix.run/)

The full URL looks like this:
```
GET
	https://udisc.com/__manifest?p=/courses&p=/courses/carey-park-disc-golf-course-e2a5&p=/courses/cheney-state-park-disc-golf-course-west-DnNL&p=/courses/chisholm-trail-3RqD&p=/courses/cowskin-mKI4&p=/courses/cowskin-west-MXwZ&p=/courses/dragon-disc-golf-course-ePkd&p=/courses/flying-bee-country-club-WOm5&p=/courses/garden-plain-city-park-dgc-dsry&p=/courses/helten-gardens-Bupy&p=/courses/keith-l-christner-family-dg-course-kLoh&p=/courses/lazys-links-1S2k&p=/courses/liberty-links-disc-golf-course-uwbs&p=/courses/linear-park-0KnA&p=/courses/llama-loop-qBK4&p=/courses/maize-south-dgc-0eco&p=/courses/newman-university-9Fmt&p=/courses/orchard-disc-golf-course-7F1E&p=/courses/prairie-winds-disk-golf-course-LiKg&p=/courses/quail-run-gFli&p=/courses/west-millbrook-dgc-tDG5&version=149b0717
```

While this does tell us a lot, it doesn't give us any real data. If we
try changing filters, we see another useful call.

`GET https://udisc.com/courses.data?sortOrder=rating`

Fore! Data incoming. While it's very, **very** obfuscated, you can see some real
data in there.

We also can confirm our suspicions by looking at the response headers:
```
x-remix-response yes
```

Most definitely a Remix based app.

### Parsing The Data

Looking at the data itself, it looks JSON-y, but when trying to parse it, we find
it's corrupt and it fails. There are some foreign chars between two valid JSON
arrays. This seems intentional as it's not breaking their site so they must
know about it? Regardless, let's scrub that out.

This function takes our raw string and iterates over it creating a stack and
checking for valid opening JSON brackets. When it finds an opening bracket, it
pushes it to the stack, and when it finds a closing bracket, it pops one off.
When the stack is empty, we know the JSON structure is complete.

```
export function extractJsonChunks(raw: string): any[] {
  const chunks: any[] = [];
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === '[' || raw[i] === '{') {
      const start = i;
      const stack = [raw[i]];
      i++;

      while (i < raw.length && stack.length > 0) {
        if (raw[i] === '[' || raw[i] === '{') {
          stack.push(raw[i]);
        } else if (raw[i] === ']' || raw[i] === '}') {
          stack.pop();
        }
        i++;
      }

      const chunk = raw.slice(start, i);
      try {
        chunks.push(JSON.parse(chunk));
      } catch {
        // ignore invalid chunks
      }
    } else {
      i++;
    }
  }

  return chunks;
}
```

#### Inspecting The Data

After successfully parsing the data, and there is **a lot** of it, we can take
a better look at two very large arrays.

The first part of the first array is mostly config looking stuff - API tokens for
various services and basic user settings like locale.

My interest is mostly in the actual data, which you can kind of see in the snippet
below. These are items in the array, so you can tell the data is there but it's
very confusing to read and code against. It would be easy to assume a key then
a value but then you see things like `price`, followed by `status` and can tell
`price` is obviously missing a value.

```
"_id",
"cxYvYpWXX66MoAG5f",
"name",
"Orchard Disc Golf Course",
"headline",
"Moderately wooded technical course, Par 54 unless hole 5 is in long., making that a par 4 hole. (course 55)",
"longDescription",
"18 holes, 1 tee for each hole, 2 basket locations for each hole, rotated regularly.  ",
"holeCount",
18,
"price",
"status",
"Active",
"website",
"https://www.facebook.com/groups/270758746431057",
```

Before any of that actual data, there is an array which didn't make much sense
at first.

After some time digging and debugging (and a little help from ChatGPT), it
clicked into place.

```
"courseResults",
  [
    73,
    253,
    305,
    382,
    451,
    538,
    598,
    661,
    718,
    774,
    821,
    864,
    919,
    979,
    1026,
    1074,
    1123,
    1174,
    1224,
    1285
  ],
  {
    "_74": 75,
    "_76": 77,
    "_78": 79,
    "_80": 81,
    "_82": 83,
    "_84": 21,
    "_85": 86,
    "_87": 88,
    "_89": 90,
    "_91": 92,
    "_93": 94,
    "_95": 96,
    "_97": 98,
    "_99": 100,
    "_101": 102,
    "_103": 104,
    "_105": 106,
    "_107": 108,
    "_109": 110,
    "_111": 112,
    "_113": 114,
    "_115": 116,
    "_117": 118,
    "_120": 121,
    "_122": 123,
    "_124": 125,
    "_126": 7,
    "_127": 128,
    "_129": 130,
    "_138": 139,
    "_143": 144,
    "_145": 146,
    "_162": 108,
    "_163": 164,
    "_165": 166,
    "_167": 168,
    "_56": 170,
    "_171": 172,
    "_221": 222,
    "_223": 125,
    "_224": 125,
    "_225": -5,
    "_226": 125,
    "_227": 228,
    "_230": 231,
    "_235": 21,
    "_236": 21,
    "_237": 7,
    "_238": 125,
    "_239": 7,
    "_240": 7,
    "_241": 7,
    "_242": 21,
    "_243": 7,
    "_244": 245,
    "_246": 247,
    "_252": -7
  },
```

The first array, `courseResults` is an index map telling us where in this giant
array each result is. If you look at the site where we found this URL, you
will notice 20 courses in the UI - it just so happens that there are 20 items
in that `courseResults` array.

If you happen to check `array[73]`, it's the following object and that
turns out to be a schema map - saying that the field name at `array[74]`
is equal to whatever is at `array[75]` and so on.

So, taking this further, the first result will have values in this giant array
from `74` to `252`. If you notice in our index map array above, the second
result will start at `253` so that makes perfect sense.

If you look at `array[253]` you will find another schema index to indicate
where to can find all the key value pairs for the 2nd result, which will actually
start at `array[254]`.

To summarize a bit on how this data is encoded:

- The file contains multiple top-level JSON blocks, pasted together without separators
- The structure includes:
  - A **top-level** array of values (strings, numbers, objects)
  - An array named `courseResults` that lists indices into that top-level array
  - A set of **object maps** (e.g. at index 73, 253, etc.) that map "key index" → "value index"

**Key Insight:**

The file is basically a compressed CSV, but:

- Field names and field values are **stored in different locations**
- Object schema = `{ "_76": 77, "_78": 79 }` → `"name"` is at 76, value is at 77


#### Putting It All Together

After deciphering how to read the data manually, it was time to do it programmatically.

With the help of ChatGPT, I wrote a couple functions that would
take our original data and format it down to something much more useable.

```
function findCourseResultIndices(data: any[]): number[] {
  for (let i = 0; i < data.length; i++) {
    if (
      Array.isArray(data[i]) &&
      data[i].every((v: unknown) => typeof v === 'number') &&
      data[i - 1] === 'courseResults'
    ) {
      return data[i];
    }
  }
  throw new Error('Could not find courseResults array');
}

export function extractCourses(data: any[]): Record<string, any>[] {
  const schemaIndices = findCourseResultIndices(data);
  const courses: Record<string, any>[] = [];

  for (const schemaIndex of schemaIndices) {
    const schema = data[schemaIndex] as Record<string, number>;
    if (typeof schema !== 'object' || Array.isArray(schema)) continue;

    const course: Record<string, any> = {};

    for (const [rawFieldKey, valueIndex] of Object.entries(schema)) {
      const fieldKeyIndex = parseInt(rawFieldKey.replace(/^_/, ''), 10);
      const fieldName = data[fieldKeyIndex];
      const value = data[valueIndex];

      if (typeof fieldName === 'string') {
        course[fieldName] = value;
      }
    }

    courses.push(course);
  }

  return courses;
}
```

`extractCourses` courses is a function that takes an array of any types.

First, it calls out to another function, `findCourseResultIndices`. That function
is iterating over the array, looking for another array of all numbers that is
preceded by a string named `courseResults` and returns it.

Then we take that list of indices back and iterate over it. For every index
in that list, we build a schema of key value pairs and rebuild down into a simple
`Record`.

The result is something like this:

```
{
    _id: 'cxYvYpWXX66MoAG5f',
    name: 'Orchard Disc Golf Course',
    headline: 'Moderately wooded technical course, Par 54 unless hole 5 is in long., making that a par 4 hole. (course 55)',
    longDescription: '18 holes, 1 tee for each hole, 2 basket locations for each hole, rotated regularly.  ',
    holeCount: 18,
    price: '',
    status: 'Active',
    website: 'https://www.facebook.com/groups/270758746431057',
    latitude: 38.0998054149767,
    longitude: -97.87738949287784,
    locationText: 'Hutchinson, KS',
    yearEstablished: 2018,
    courseId: 20619,
    ratingCount: 755,
    ratingAverage: 4.385343483628396,
    country: 'United States',
    countryCode: 'US',
    state: 'Kansas',
    city: 'Hutchinson',
    accessType: 'everyone',
    availabilityStatus: 'available',
    availabilityType: 'yearRound',
    landType: [ 226 ],
    targetType: 'basket',
    targetTypeDescription: 'DISCatcher Pro (28 chains)',
    hasBathroom: true,
    hasDrinkingWater: false,
    propertyType: 'mixedUse',
    conditions: { _146: 195, _196: 21, _197: 342, _199: 343 },
    location: { _146: 166, _167: 345 },
    shortId: '7F1E',
    topPhoto: {
      _74: 348,
      _242: 349,
      _244: 350,
      _246: 351,
      _248: 352,
      _250: 353,
      _252: 354,
      _254: 355
    },
    admin1Name: 'Kansas',
    worldRankingsRating: 86.11626662182661,
    activeTargetTypes: [ 340 ],
    activeTeeTypes: [ 259 ],
    timezone: 'America/Chicago',
    layoutConfiguration: { _127: 360, _134: 363, _139: 374, _155: 380, _162: 383 },
    playFeeType: 'free',
    isCartFriendly: true,
    isDogFriendly: true,
    limitedAccessReason: undefined,
    isSmartLayoutEnabled: true,
    difficultyBins: [ 203 ],
    contactInfo: { _387: 388, _389: 388 },
    accessTypeDescription: '',
    availabilityTypeDescription: '',
    byob: false,
    dedicatedTargets: true,
    hasAvailabilityRestrictions: false,
    isLocationPrivate: false,
    isStrollerFriendly: false,
    otherFees: '',
    underConstruction: false,
    accessibility: 'notAccessible',
    distanceFromSelectedPlace: { _206: 397, _208: 398 },
    badgesInfo: undefined
  },
```

Voila! We have a well formed `Course` object. If you look at fields like
`topPhoto`, it looks like the schema map field reference rabbit hole goes even
deeper but that's for another post.

#### Summary

In this post, we have:
- Found URL for `Courses`
- Scrubbed and extracted (broken) JSON from said URL
- Discovered data included index and schema maps
- Wrote functions to format data into useable object

#### Plan For Next Time

Enable the user to search for a `Place` and `Courses`.


#### Disclaimer

The data accessed in this post is publicly available via standard browser
network requests and does not require login, tokens, or circumvention of
protections.

It it accessed as fair use and for educational purposes.
