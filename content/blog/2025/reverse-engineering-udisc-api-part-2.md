+++
title = "Reverse engineering UDisc's API - Part 2, Search"
date = 2025-05-29
+++

First part of the series, Courses, can be found here:
[Courses](https://jakegoldsborough.com/blog/2025/reverse-engineering-udisc-api-part-1/)

#### Search for Places
In the first post in this series, we were able to parse and extract a list
of `Course` data. This is great, but we're simply getting back 20 random courses
that might not mean anything to the end user. Lucky for us, there are a couple
search options.

Going to [https://udisc.com/courses](https://udisc.com/courses) and starting to
type in the search box reveals some network calls:

`/places/search?term=charlotte&limit=5`

This is getting called for every character that is typed and should probably
be debounced a little.

Anyway, from that call, we get some pretty well formed data instead of the
index/schema map data like before. Here is one result:

```
{
"_id": "NxHZZBpPjDnXHbbZg",
"type": "city",
"slug": "charlotte-nc",
"name": "Charlotte",
"country": "United States",
"countryCode": "US",
"admin1": "North Carolina",
"city": "Charlotte",
"location": [
  -80.84313,
  35.22709
],
"score": 98.75883083083083,
"fullLocationText": "Charlotte North Carolina United States",
"highlights": [
  {
    "score": 1.4719792604446411,
    "path": "fullLocationText",
    "texts": [
      {
        "value": "Charlotte North Carolina",
        "type": "hit"
      },
      {
        "value": " United States",
        "type": "text"
      }
    ]
  }
],
"autocompleteScore": 72.5995921895284
},
```

There seem to be a few options for `type`.
- city
- admin1 (which appears to represent state in the US)
- country

Now, you can take that `slug` and plug it into the courses call:

`/courses.data?placeId=charlotte-nc`

See the first [post](https://jakegoldsborough.com/blog/2025/reverse-engineering-udisc-api-part-1/)
on how to parse and extract that data.

#### Search for Courses

The Places endpoint was not the only one being hit though. When typing in the
search box, you will also see this:
`/api/courses/search?includeGenerallyUnavailableCourses=true&term=hornets nest&limit=5`

Again, we get some pretty well formed data:

```
{
"_id": "jJAW46X3WX8qT7mXR",
"locationText": "Charlotte, VT",
"ratingAverage": 3.4976632020706235,
"courseId": 11220,
"ratingCount": 239,
"name": "Charlotte Beach",
"shortId": "j04j",
"highlights": [
  {
    "score": 2.771970748901367,
    "path": "name",
    "texts": [
      {
        "value": "Charlotte",
        "type": "hit"
      },
      {
        "value": " Beach",
        "type": "text"
      }
    ]
  }
],
"searchScore": 11.487470626831055,
"autocompleteScore": 11.66234797214058
},
```
Next time I will show you how to take that data and get a specific `Course`
endpoint and data.

#### Another Way to Fuzzy Find Courses

Not exactly a search but there appears to be at least one more way of fuzzy finding
courses. The `courses.data` endpoint can take another param called
`courseTerm`. The full URL would be:

`/courses.data?courseTerm=charlotte`

This will return course results with "Charlotte" in the name. I'm thinking
this endpoint is there for list type pages and the search endpoint might just be
for autocomplete drop downs.

#### Summary

Showed how to search for places and courses

#### Plan for Next Time

Drill down into specific course data

#### Disclaimer

The data accessed in this post is publicly available via standard browser
network requests and does not require login, tokens, or circumvention of
protections.

It it accessed as fair use and for educational purposes.
