---
title: Fairway Client Not Fair Enough for MyFrisbee
date: '2025-07-06'
description: The story of building an open source library to access public MyFrisbee
  data endpoints, receiving a takedown request despite working with user-submitted
  information, and the disappointment that followed.
taxonomies:
  tags:
    - oss
    - APIs
---

### Takedown Request

Recently, I've been writing about reverse engineering a unique data
structure I found while investigating the UDisc web app. I also created
a free and open source library called Fairway Client. It's a fair way for
accessing UDisc's `.data` endpoints - the same ones their own web app uses.
These are public, unauthenticated endpoints available to any browser.

The only intent was curiosity and a belief in open, user-accessible data
and software. People have asked for this kind of access before, and
UDisc has repeatedly said no. So I decided to see for myself. The data
was right there - how hard could it be?

Turns out, not very.

Much of this data is **user-submitted**, and in some cases, **user-paid**.
UDisc does offer a CSV export, but come on - programming is about
automation, not downloading spreadsheets.

I posted about my findings and tools on the UDisc forum. That didn't go
well. First, I didn't realize posts were moderated so my comment never got
posted and that's on me. Second, they weren't pleased. I received a sternly
worded email asking me to remove both the blog series and the codebase.

I wasn't sure what to expect - but I was still disappointed.
I was hoping for curiosity, maybe even appreciation.
Instead, I got a takedown request.

They cited their ToS, but if offering a clean, read-only interface to user-owned
public data violates the ToS, maybe it's the ToS that is wrong.

The the code is down. I will be obscuring the posts to not reveal details but I
have spent time and effort on them so they will be staying up in some form.

It might be time to give disc golf metrix a shot:
[https://discgolfmetrix.com/](https://discgolfmetrix.com/)
