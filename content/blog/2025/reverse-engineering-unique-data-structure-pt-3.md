---
title: Reverse Engineering A Unique Data Structure - Part 3, Course & Course Details
date: '2025-09-03'
description: Decoding deeply nested course data by resolving schema maps within schema
  maps to extract readable information about disc golf courses including layouts,
  holes, and amenities.
taxonomies:
  tags:
    - APIs
    - typescript
---

Second part of the series, Search, can be found here:
[Search for Places and Courses](/blog/2025/reverse-engineering-unique-data-structure-pt-2/)

In the previous two posts, we learned how to `GET`, scrub, and parse `Courses`
data, as well as how to use the search endpoint for `Places` and `Courses`.

#### Viewing a Specific Course
In this post, we will build on the previous data and show how to find the endpoint
for a specific course and drill down into more data. We'll focus on the
`courseDetails`, using the beloved Maple Hill as our example:

```
{
  "_id": "M6vT9WAEmtFKRFr2v",
  "name": "Maple Hill",
  "ratingCount": 10064,
  "ratingAverage": 4.899286515846228,
  "locationText": "Leicester, MA",
  "courseId": 1523,
  "shortId": "lCej",
  "highlights": [
    {
      "score": 2.803980588912964,
      "path": "name",
      "texts": [
        {
          "value": "Maple",
          "type": "hit"
        },
        {
          "value": " ",
          "type": "text"
        },
        {
          "value": "Hill",
          "type": "hit"
        }
      ]
    }
  ],
  "searchScore": 15.834041595458984,
  "autocompleteScore": 16.079005921251294
}
```

The URL for a course will be a slugified course name, plus the `shortId`.
For Maple Hill, this URL is:
`https://myfrisbee.com/courses/maple-hill-lCej.data`

Based on observation, spaces become dashes, and special characters are removed
when generating the slug.

For example, Keith L. Christner Family DG Course becomes
keith-l-christner-family-dg-course.

#### Inspecting the Data
The response from this endpoint is **massive**--so much so that Firefox
truncates it in the Network tab. I had to use curl and save the file locally
just to inspect it.

Again, we are greeted by a large array of mixed types. The more I'm reading and
learning, it seems like this may not actually be done for any kind of
obfuscation, but for performance or a client side hydration strategy. The
response is very large but it's a full page of data and probably replaces
multiple API calls.

This time, the response goes even deeper: it includes a schema map of schema
maps, where keys don't point directly to data, but to other schema maps that
must be resolved first.

```
"routes/courses/$slug/index",
  {
    "_3": 143
  },
  {
    "_144": 145,
    "_335": 336,
    "_343": 344,
    "_24719": 24720,
    "_24957": 24958,
    "_25013": 25014,
    "_25150": 25151,
    "_25410": 25411,
    "_25435": 25436,
    "_25481": 25482,
    "_25513": -7,
    "_25514": 25515
  },
```

The second object is just full of references to other references. If you follow
each one of those schema maps, we can sometimes get the location of each
field's key and value. Often times, there are just more schema maps to follow.
Here is a small snippet:

```
"smartLayouts": [345, 3534, 12323, 13767, 14131, 14506, 19520, 22543],
"classicLayouts": [24721],
"reviews": [24959, 24981, 24992, 25002],
"photos": [25015, 25083, 25097, 25107, 25128],
"nearbyCourses": [25152, 25226, 25280, 25344],
```

Going to `array[345]`, we get this:
```
{
  "_66": 346,
  "_84": 85,
  "_347": 348,
  "_349": 350,
  "_72": 3505,
  "_3506": 195,
  "_3507": 3508,
  "_147": 256,
  "_3509": 3510,
  "_3511": 3512,
  "_3513": 3514,
  "_3515": 3516,
  "_3517": 3518,
  "_104": 3519,
  "_167": 3520,
  "_3521": 131,
  "_3522": 320,
  "_3523": 3524,
  "_3525": 3526,
  "_3527": 2679,
  "_3528": 679,
  "_3529": 3530,
  "_396": 3531
}
```

Going to some of those references leads to actual data, but again, often times
it's just more mappings.

Now that it makes sense manually, let's write some code to do it programmatically.

At a high level, the flow is:

```
const schemaMap = resolveCourseSchemaMapSchema(data);
const courseDetailsSchema = schemaMap.courseDetail;
const courseDetails = resolveKeyAndValueNames(courseDetailsSchema, mockCourse);
```

1. Break the big array down into a schema map of schema maps
2. Pass that `courseDetailsSchema` and our original array to `resolveKeyAndValueNames`

#### Resolving a Course's Details Structure

The function below does 3 important things:
- finds our route key label. this key seems to precede the schema map.
- follows the next pointer to the schema map schema map
- passes that to `resolveKeyAndValueNames` to resolve each set of key/values

```
export function resolveCourseSchemaMapSchema(data: any[]) {
  for (let i = 0; i < data.length - 2; i++) {
    const label = data[i];
    const pointerMap = data[i + 1];
    const schemaMap = data[i + 2];

    if (
      label === "routes/courses/$slug/index" &&
      typeof pointerMap === "object" &&
      typeof schemaMap === "object" &&
      Object.keys(pointerMap).length === 1
    ) {
      const pointerIndex = Object.values(pointerMap)[0];
      const referencedMap = data[pointerIndex];

      if (typeof referencedMap === "object") {
        return resolveKeyAndValueNames(referencedMap, data);
      }
    }
  }
}
```

That leaves us with a decoded schema object, where each field (like
`courseDetail`, `reviews`, `smartLayouts`) still contains schema references or
arrays of indexes:

```
{
  courseDetail: {
    _66: 67,
    _68: 69,
    _146: 131,
    _147: 148,
    _72: 73,
    _149: 109,
    _150: 151,
    _152: 108,
    _84: 85,
    _153: 154,
    _96: 97,
    _155: 156,
    _158: 159,
    _160: 161,
    _162: 163,
    _164: 165,
    _102: 172,
    _110: 111,
    _130: 131,
    _174: 175,
    _176: 177,
    _180: 181,
    _184: 185,
    _56: 302,
    _303: 304,
    _305: 131,
    _132: 7,
    _133: 131,
    _306: 307,
    _308: 309,
    _310: 311,
    _312: 313,
    _314: 315,
    _316: 317,
    _318: 319,
    _134: 131,
    _323: 324,
    _328: 21,
    _329: 330,
    _331: 7,
    _332: 131,
    _333: 7,
    _334: 7
  },
  normalizedCourseTraffic: { _337: 338 },
  smartLayouts: [
      345,  3534,
    12323, 13767,
    14131, 14506,
    19520, 22543
  ],
  classicLayouts: [ 24721 ],
  reviews: [ 24959, 24981, 24992, 25002 ],
  photos: [ 25015, 25083, 25097, 25107, 25128 ],
  nearbyCourses: [ 25152, 25226, 25280, 25344 ],
  nearbyStores: [ 25412, 25424 ],
  events: [ 25437, 25460, 25470 ],
  badges: [
    25483, 25494, 25498,
    25500, 25505, 25506,
    25508, 25509, 25511,
    25512
  ],
  globalLayoutAverages: undefined,
  userStatus: 'loggedOut'
}
```

Next is our core function. We take the `courseDetail` schema map and pass it
and our original data array to `resolveKeyAndValueNames` to resolve the
actual values.

```
/**
 * Resolves a schema map where both keys and values are index references into the data array.
 */
export function resolveKeyAndValueNames(schema: Record<string, number>, data: any[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const rawKey in schema) {
    const keyIndex = parseInt(rawKey.replace(/^_/, ""), 10);
    const valIndex = schema[rawKey];

    const fieldName = data[keyIndex];
    if (typeof fieldName !== "string") {
      throw new Error(`Expected string field name at index ${keyIndex}, got: ${typeof fieldName}`);
    }

    result[fieldName] = data[valIndex];
  }
  return result;
}
```

We are now left with a nicely formatted and readable object of values:

```
{
  "_id": "M6vT9WAEmtFKRFr2v",
  "holeCount": 18,
  "isPay": true,
  "status": "Active",
  "name": "Maple Hill",
  "latitude": 42.276001,
  "website": "http://maplehilldiscgolf.com",
  "longitude": -71.895699,
  "courseId": 1523,
  "country": "United States",
  "availabilityStatus": "available",
  "landType": [157],
  "targetType": "basket",
  "targetTypeDescription": "Black Hole Portal, Black Hole Gravity Version 2",
  "availabilityTypeDescription": "Closed the Sunday before Thanksgiving to New Years for Christmas Tree Season. ",
  "conditions": {
    "_104": 166,
    "_167": -5,
    "_168": 169,
    "_170": 171
  },
  "location": {
    "_104": 105,
    "_106": 173
  },
  "shortId": "lCej",
  "hasBathroom": true,
  "propertyType": "dedicated",
  "activeTargetTypes": [178, 179],
  "activeTeeTypes": [182, 183],
  "layoutConfiguration": {
    "_186": 187,
    "_223": 224,
    "_251": 252,
    "_289": 290,
    "_299": 300,
    "_301": -5
  },
  "timezone": "America/New_York",
  "otherFees": "$5 Walker fee for those not playing",
  "isSmartLayoutEnabled": true,
  "hasDrinkingWater": false,
  "isDogFriendly": true,
  "amenitiesRating": 4.754434159544442,
  "designRating": 4.920076530755979,
  "sceneryRating": 4.923442842581462,
  "signageRating": 4.747814409366677,
  "teeRating": 4.882374770235053,
  "upkeepRating": 4.891556089317444,
  "difficultyBins": [320, 321, 322],
  "isCartFriendly": true,
  "contactInfo": {
    "_325": 326,
    "_327": 326
  },
  "accessTypeDescription": "",
  "accessibility": "notAccessible",
  "byob": false,
  "dedicatedTargets": true,
  "hasAvailabilityRestrictions": false,
  "underConstruction": false
}
```

Note: Some fields like `conditions`, `location`, and `layoutConfiguration` are
still partially encoded -- they contain their own schema maps or references that
need to be decoded separately using `resolveKeyAndValueNames`. We'll cover
those in a future post when we dive deeper into layout and field-level data.

#### Summary

In this post, we decoded the structure of MyFrisbee's `courseDetails` payloads by:

- Resolving the `"routes/courses/$slug/index"` entry
- Using `resolveCourseSchemaMapSchema` to get a field-labeled schema
- Running that through `resolveKeyAndValueNames` to extract readable values

This pattern gives us a fully usable course object with real field names. While
some nested fields (like `conditions` or `layoutConfiguration`) still require
additional decoding, we now have the tools to confidently work with MyFrisbee's
structured course data.

#### Next Time

In the next post, we'll go one level deeper--resolving nested layout data like
hole-by-hole distances and tee types.
