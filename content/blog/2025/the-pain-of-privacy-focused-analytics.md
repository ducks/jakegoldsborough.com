+++
title = "The Accidental Complexity of Doing The Right Thing or The Pain of Setting Up Privacy-Focused Analytics (2025 Edition)"
date = 2025-06-22
[taxonomies]
tags = [ "devops", "privacy" ]
+++

### Introduction

- just want simple pageview count
- care about privacy, **NO** tracking, cookies, IP logging etc
- like most things, it's much harder to be ethical than invasive

### Attempt 1: Server-side access logs (Caddy)

- enable http logs
- scrape log file
- analyze requests for "views"

### Attempt 2: Goatcounter via Docker

- use goatcounter with docker
- original docker image moved/gone
- new image has perm issues

### Attempt 3: Building own Goatcounter Docker image

- buildx required
- docker image build failed first time with timeouts

### Attempt 4: Run bin manually? (ugh)

-

### Observations

- docker was supposed to make this simple
- broken registry, perm issues, shifting build standards made this hard
- self hosted projects often don't have resources to support all the things
- friction discourages ethical solutions

### Conclusions

- privacy-first solutions exist, tooling causes friction which discourages adoption
- there is an opportunity to improve OS tooling around privacy focuses tools
