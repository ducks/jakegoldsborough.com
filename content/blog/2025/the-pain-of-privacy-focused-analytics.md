+++
title = "The Accidental Complexity of Doing The Right Thing or The Pain of Setting Up Privacy-Focused Analytics (2025 Edition)"
date = 2025-06-22
[taxonomies]
tags = [ "devops", "privacy" ]
+++

### Introduction

As I've mentioned in the past, I’ve been writing and blogging more, and I
became curious if anyone was actually reading my posts.

Before I go any further, I need to make it clear that I am very
privacy-focused. I hate logging, tracking, fingerprinting, or any kind of
unnecessary data collection. A user’s data is theirs -- I have no interest in
storing anything about them. I just want a basic count of which pages are being
visited.

Naturally, I asked ChatGPT for recommendations based on my current setup.

I'm already using Caddy as my web server and TLS manager, so the first
suggestion was straightforward: just enable HTTP access logs and analyze them.

### Attempt 1: Server-side access logs (Caddy)

The basic flow here would be:
- enable http logs in Caddy
- scrape log file
- count requests as rough pageviews

In theory, this sounded perfect. I wasn’t looking for fancy dashboards or
detailed metrics -- just simple counts of which pages were being hit. Plain log
files should be more than enough.

Caddy, by default, doesn't actually log HTTP requests unless you configure it
to. More surprisingly, in many builds of Caddy (especially those provided by
package managers), the `http.handlers.log` module isn’t even included.

At first I thought I was on the wrong version, but after some digging, I
realized that full HTTP access logging in Caddy requires building your own
custom binary with [`xcaddy`](https://caddyserver.com/docs/build#xcaddy) to
enable the logging module. This felt like massive overkill for something as
basic as HTTP request logging.

After trying multiple versions, failing to get access logs working, and
realizing that Caddy’s modular architecture was actively getting in my way, I
gave up on this approach.

I asked ChatGPT for other options.

### Attempt 2: Goatcounter via Docker

The next recommendation was to use a dedicated privacy-first analytics tool.
Several good open-source options exist:
[GoatCounter](https://github.com/arp242/goatcounter), Plausible, and Umami.

After doing a bit of research, GoatCounter stood out. It’s fully open-source,
extremely privacy-focused, lightweight, and seems purpose-built for people like
me who just want simple pageview counts without any tracking nonsense.

Even better, GoatCounter has Docker images available.

But of course — the Docker image that used to be hosted on Docker Hub was no
longer available. The project had moved its images to GitHub Container Registry
(GHCR), and GHCR was returning permission errors when I tried to pull the image
anonymously. Apparently GHCR increasingly requires authentication even for
public images, depending on Docker version, client configuration, and random
GitHub API mood swings.

### Attempt 3: Building my own Goatcounter Docker image

After that, I decided to just build the image myself.

GoatCounter publishes a Dockerfile in the repo, so this should be
straightforward:

```
git clone https://github.com/arp242/goatcounter.git
docker build -t goatcounter:local .
```

The Dockerfile requires Docker BuildKit support, and uses newer Dockerfile
features like `--exclude`, which aren't supported by Docker’s legacy builder. I
had to enable BuildKit, but enabling BuildKit required `docker-buildx`, which
wasn’t installed by default on my Arch system.

Once I installed `docker-buildx`, I ran the build again. This time, it started
pulling Go modules but failed with timeouts halfway through the build.

I retried. And retried. BuildKit timeouts, network flakiness, CDN rate limiting
-- you name it. What should have been a 30-second build turned into multiple
rounds of fighting with Docker’s build system and Go’s module proxy ecosystem.

At this point, Docker was no longer simplifying anything — it was actively
making everything worse.

### Attempt 4: Running GoatCounter directly

By this point I was fully in "I don’t even care anymore" mode.

GoatCounter is a Go program that ships prebuilt binaries. I could just download
the standalone Linux binary and run it behind Caddy directly, without Docker at
all.

Except even that wasn't as straightforward as it should have been.

The download URL on GitHub releases points to a gzip-compressed file. I
accidentally downloaded it and tried running it directly without decompressing
it first, leading to confusing shell errors ("command not found" as it tried to
parse the binary as text). Once I properly decompressed it, I finally had a
functioning ELF binary.

I ran `goatcounter serve`, initialized the SQLite database, and got it fully
running behind Caddy with one reverse proxy entry. TLS worked automatically,
and finally, my simple analytics system was live.

### Observations

Docker was supposed to make self-hosting trivial. But broken registries,
permission issues, changing build standards, and fragmented tooling made things
much harder. Self-hosted projects often don't have the resources to maintain
registry hosting, Docker images, and packaging across multiple platforms.
The friction involved in doing things ethically discourages people from even
trying privacy-respecting solutions.

It's no surprise so many people just give up and paste Google Analytics into
their site -- it's not better technology, it's easier deployment.

### Conclusions

Privacy-first analytics tools absolutely exist — GoatCounter is an excellent
project, and I’m very happy with it now that it’s running.

But the tooling friction creates artificial barriers that discourage adoption.
Ironically, it's often easier to deploy privacy-invasive analytics than
privacy-respecting ones.

There’s a huge opportunity here to improve the ecosystem:

- Smarter build tooling
- Better Docker automation
- Easier packaging of self-hostable apps
- (Maybe even a tool that turns install instructions into Dockerfiles
  automatically — but that’s a post for another day...)

If we want ethical software to be the default, we need to make it easier, not
harder.
