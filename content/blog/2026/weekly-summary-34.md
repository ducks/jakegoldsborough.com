---
title: Agent assisted Changelog - 34/52
date: '2026-08-21'
description: Replaybook became a multi-harness benchmark with 240 comparable
  trials, Agents of Empires became something worth watching, and I built a
  GitHub CLI because one GraphQL query failed too many times.
taxonomies:
  tags:
    - agents
    - changelog
---

One week since the last changelog. I am going to enjoy that sentence before
the streak becomes statistically meaningful.

Last week was about getting agents into real machines. This week was about
everything that comes after: proving two runs mean the same thing, making the
evidence inspectable, letting another harness through the door, and turning a
terminal full of events into something another human might actually want to
watch.

I also built a GitHub CLI, deployed a tattooer directory, gave my art site a
writing section, and learned that a 28-inch bowl of tufted ramen is apparently
easier to publish than a Reddit post about a 28-inch bowl of tufted ramen.

## Replaybook: from benchmark run to benchmark system

[Replaybook](https://github.com/ducks/replaybook) had its biggest clean result
yet: 240 trials across sixteen infrastructure incidents, five models, and
three attempts per model/scenario pair. Every attempt used the same frozen
host harness, scenario versions, Claux release, reasoning level, and
900-second deadline. Interrupted trials resumed from their immutable snapshots
until all 240 had a valid evaluated result.

Qwen3.8 2.4T A95B led at 46/48 durable repairs. GLM 5.3 finished 45/48, Luna
44/48, DeepSeek V4 Flash 42/48, and Gemini 3.7 Flash 37/48. The whole cohort
cost $22.4110 in known spend, with two Luna attempts still making that total a
lower bound. DeepSeek remained the cheap one. GLM remained the unusually good
balance. Qwen won the actual reliability column.

Those distinctions matter because this was finally one comparison boundary.
Earlier benchmark pages had accumulated good results from different days,
harness versions, scenario sets, and attempt counts. They were useful evidence,
but arranging them near each other did not turn them into a leaderboard. The
publisher now carries explicit infrastructure tiers, exact scenario
compatibility, agent-harness identity, provider lane, and billing mode. A new
comparison view can put model cohorts side by side, but it also says when the
harness, tier, scenarios, attempts, or deadline differ instead of quietly
averaging the problem away.

The scenarios got more real too. Five models successfully installed an actual
pinned Discourse container on a prepared Linux host, backed by PostgreSQL and
Redis with persistent uploads and application state. Luna did it in 10:02 for
$0.0270. DeepSeek took 29:12 and crossed the finish line 48 seconds before the
deadline, but cost only $0.0310. A static imitation or temporary development
server could not pass; the deployment had to survive service restart and a
full host reboot.

Then came a broken Discourse plugin, a partial service rollout, and a Nix store
under disk pressure. The Nix scenario was satisfying for obvious reasons. My
benchmark runner had already filled my real disk with Nix stores once. It was
only fair to make the models clean one up.

The free mystery model `stealth/ox-alpha` went through the full suite too:
42/48 repairs, an 88% pass rate, a 2:50 median, and exactly $0. It was not the
best model in the cohort. It was an absurd amount of infrastructure work for
the price.

## A second harness walked in

Until this week, Replaybook could claim to support agent adapters while nearly
all of its public evidence still came through Claux. So I bought the $5
introductory [OpenCode Go](https://opencode.ai/docs/go/) plan and ran OpenCode
directly inside the same disposable incident machines.

That turned the abstraction into a real boundary. OpenCode's JSONL events now
normalize into Replaybook's usage, timing, tool, transcript, and outcome
records. Subscription runs report cost as unavailable instead of pretending
that a monthly allowance has a per-request price. The benchmark site presents
the OpenCode cohort alongside Claux/OpenRouter evidence without labeling one as
the other or pooling the scores.

It also produced a better provider bug report than “GLM seems flaky.” One GLM
5.3 request failed before inference with `ProviderModelNotFoundError` even
though `opencode models` advertised it. Other sessions started normally, then
received repeated endpoint-unavailable responses before ending in HTTP 503.
Replaybook retained the timestamps, session records, stderr, and normalized
result bundle. Those attempts remain visible as provider-unavailable, not
evidence that GLM could not fix Linux.

After recovering VM infrastructure holes, the five-scenario OpenCode cohort
ended with DeepSeek at 15/15 evaluated repairs. GLM repaired 11/11 evaluated
attempts with four provider outages. Luna, Kimi 2.7 Code, and Qwen 3.8 Max each
finished 14/15; MiniMax M3 finished 12/15. Same controller and verifier,
different agent harness. That is now a comparison Replaybook can describe
without pretending it is the same experiment.

I emailed OpenCode both the pitch and the failure evidence. Replaybook is
starting to produce artifacts that may be useful to the people operating the
models and harnesses, not just to me staring at their scores.

## Agents of Empires became watchable

[Agents of Empires](https://github.com/ducks/agents-of-empires) started as
three agents racing inside blank NixOS machines. The terminal could prove who
won. It could not make the quiet middle of a match interesting.

Now each arena can define a service map tied directly to referee milestones.
An API, queue, worker, proxy, database, replica, or host changes state only when
the verifier has evidence for it. The replay clock drives the topology,
timeline, and a set of fake terminals built from real observable tool events.
Scrubbing backward rewinds all three. A long thinking gap says no tool activity
was observed; it does not invent a chain of thought to fill the silence.

Fog of war made the same evidence boundary part of the game. The agent receives
a constrained player brief. The controller retains the private topology and
verifier. The map reveals the system as observed referee events arrive. A
deterministic transcript analyzer classifies discovery, mutation, lifecycle,
validation, and errors without reading private reasoning, so the match report
can show [how each agent fought](/blog/2026/the-battleground-has-a-map-now/),
not merely which one crossed the line.

The reports also carry exact provenance now: model, harness adapter, reasoning
effort, controller revision, arena schema, compatibility key, and immutable
manifest, verifier, and adapter hashes. Historical matches keep the map and
rules they actually ran under.

GLM 5.3's first arena benchmark was the useful surprise. It has been one of
the strongest Replaybook models. In Agents of Empires, DeepSeek won seven of
twelve rounds, Luna won four, and GLM won none. DeepSeek reached 39/60
milestones, Luna 26/60, and GLM 6/60. Same broad job title, very different
shape of work. “Best infrastructure model” remains a sentence with several
missing clauses.

## Tongs: one failed GraphQL query too many

I tried to review a pull request with `gh`. A GraphQL field unrelated to the
operation failed, so the whole command failed with it.

I had already started routing around those failures with direct API calls,
which meant every agent had to rediscover authentication, pagination, response
shapes, and the small part of GitHub that genuinely requires GraphQL. That pile
of `curl` and `jq` was becoming a second, worse CLI.

So I built [Tongs](https://github.com/ducks/tongs): Typed Operations for
Networked Git Services, a GitHub CLI designed around agent workflows. Normal
pull-request work uses narrow REST operations. Review threads use GraphQL only
where GitHub requires it. Every command returns one stable JSON envelope, never
prompts, and fails with a machine-readable error and meaningful exit code.

Mutations support dry runs. Approval and merge operations include the head SHA,
so an agent cannot inspect one revision and approve another after somebody
pushes. Merge also requires an explicit method and `--yes`. The GitHub adapter
sits behind a provider boundary ready for GitLab, Gitea, or Codeberg, but those
providers honestly return `provider_not_implemented` today.

The first authentication failure found the funniest possible bug: the CLI
designed never to prompt could still fall through to Git's credential helper
and prompt. `GIT_TERMINAL_PROMPT=0` fixed that. Agent-native tools are mostly
ordinary tools with every ambiguous behavior removed, one embarrassing edge
case at a time.

The [longer writeup](/blog/2026/tongs-github-cli-built-for-agents/) is already
up.

## albo went from prototype to place

[albo](https://github.com/ducks/albo), the self-hosted curated-directory
engine, is live as the Portland Tattooer's Directory.

This week it gained real shop entities, many-to-many artist relationships,
shop and artist maps, tag filtering, free-text search, dark mode, database
admin accounts, and Open Graph cards. Artists can work
at several shops. Located shops own their coordinates; shopless artists fall
back to a personal address. The public map plots the scene instead of a pile of
duplicated artist pins.

Instagram supplied the antagonist. From my residential connection, profile
HTML returned the expected Open Graph metadata. From pond's datacenter IP, the
same request was redirected to a login wall. Browser-shaped requests received
an empty JavaScript shell. The profile API required authentication. The last
unauthenticated doors were not merely undocumented; I tested all of them and
watched them close.

That made manual curation the product rather than a temporary compromise.
Featured posts remain official Instagram embeds rendered in the visitor's
browser. The longer-term open-web path is
still there: Pixelfed, RSS, personal sites, and eventually directories that
publish their own listings. Open sources get automatic rich pages. Instagram
gets the manual floor its platform permits.

There were smaller deployment lessons hiding underneath. Askama templates are
compiled into the binary, so refreshing after a template edit shows nothing
until the server rebuilds. A Nix hash generated by `nix-prefetch-url --unpack`
did not match a `fetchzip { stripRoot = false; }` consumer because the two
paths canonicalize differently. The durable rule is simple: calculate a hash
with the same fetcher that will consume it.

## The art site made room for words

[Gnarly Void](https://gnarlyvoid.com/) finally has a writing format. A writing
post is “a void that runs longer”: it lives in its own content section, shares
the homepage and RSS stream with the artwork, and renders in a narrower reading
column. Image galleries remain available but optional. Existing art did not
have to move.

The first post is [How I Ended Up With a 28-inch Bowl of Tufted
Ramen](https://gnarlyvoid.com/writing/28-inch-tufted-ramen/), the story of a
fiber-food project becoming 28 by 28 by 12 inches one locally reasonable
decision at a time. I made the nori a foot long. Every other ingredient had to
match. Then the bowl had to hold the ingredients. Each answer was defensible.
The system was enormous.

Writing it produced a fitting correction loop. An early draft described the
noodles as macrame cord when they were actually tufted coils and invented a
feeling about the scallions that I did not remember having. Both details were
plausible. Neither was true. The post about checking the whole system had to be
checked against the actual thing.

Reddit removed every attempt to share it without identifying the policy it
thought I had violated: link post, text post, image post, my subreddit, my own
profile. The API was more precise about successfully accepting the post before
the site removed it. Apparently the open web remains the reliable part of this
story. The article is on a site I control, the images are mine, and POSSE still
works even when the syndication target decides not to.

## The through-line

Most of this week was boundary work.

A model result belongs to a harness, provider, scenario set, deadline, and
verifier. A green service belongs to the evidence that made it green. A GitHub
mutation belongs to the revision that was inspected. An artist directory can
only automate what its source platform actually exposes. A sentence in a blog
post belongs to something I can verify happened.

The tempting version of every project smooths those boundaries away. Put all
the scores in one leaderboard. Make the map animate during silence. Treat an
HTTP redirect as data. Let one large query answer everything. Trust the detail
because it fits the story.

The systems got better when the boundaries became visible instead.

Replaybook now says when two cohorts should not be pooled. Agents of Empires
shows which parts of a topology the referee has actually proved. Tongs lets an
unrelated API field fail alone. albo has stopped pretending Instagram is an
open database. The ramen post keeps the corrections that made it true.

That is less magical than hiding the seams.

It is also how the magic survives a reboot.
