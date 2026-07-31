---
title: "Schrödinger's Life: A Website That Dies When Nobody Is Looking"
date: 2026-07-31
description: "I built a shared digital creature that stays alive only while somebody has the page open. When the final observer leaves, it dies permanently."
taxonomies:
  tags:
    - rust
    - websockets
    - experiment
    - oss
---

I built a website with one rule:

The creature is alive only while somebody is looking at it.

Visit [schrodingers.life](https://schrodingers.life) and your browser opens a
WebSocket. As long as at least one visible tab stays connected, the current
creature lives. When the final observer leaves, a 30-second countdown begins.
If nobody comes back, the creature dies permanently and joins the graveyard.
The next visitor opens the box on a new life.

That is the whole application.

The first life was a common robot with × eyes. By the time you read this, it
may have lived for days or died before I finished this sentence.

I expected this to be a small Rust and WebSocket project. It immediately became
a stranger question: what will people do when closing a browser tab can kill
something?

## Observation is a WebSocket

The server is an Axum application with a SQLite database. There are no accounts,
cookies, logins, or analytics involved in deciding whether someone is looking.
The observation itself is the connection.

When the page is visible, it opens a WebSocket to `/observe`. Every ten seconds
the browser sends `still-looking`. If the tab becomes hidden, it closes the
socket:

```javascript
document.addEventListener("visibilitychange", () => {
  document.hidden ? disconnect() : resumeObservation();
});
```

That distinction matters. A tab abandoned in the background is not an
observer. Attention is the resource, not merely an open browser process.

The server also expires a connection that goes silent. Networks disappear,
laptops sleep, browsers crash, and JavaScript does not always get the chance to
say goodbye. A heartbeat keeps a real observer present without letting a dead
connection hold the creature alive forever.

Every connected browser gets the same state. The creature, its age, the number
of observers, and the countdown all update over the WebSocket. There is only
one box. Everybody is looking into it together.

## The final observer

Most connection counters get easier when they reach zero. Mine starts a death
timer.

When an observer disconnects, the server removes its UUID from a set. If anyone
remains, nothing else happens. If the set becomes empty, the current life gets
30 seconds:

```rust
world.generation += 1;
let generation = world.generation;
world.death_deadline = Some(Instant::now() + self.grace);

tokio::spawn(async move {
    tokio::time::sleep(state.grace).await;
    state.collapse(generation).await;
});
```

The generation number is the important part.

Suppose the last observer leaves and starts a timer. Ten seconds later, someone
returns and saves the creature. Then they leave too, starting a second timer.
The first timer is still asleep. Without some way to identify it as stale, it
could wake up twenty seconds later and kill a life that still has ten seconds
remaining.

Every arrival or final departure advances the generation. A timer captures the
generation that created it. When it wakes, it collapses the life only if its
generation is still current and the observer set is still empty:

```rust
if world.generation != generation || !world.observers.is_empty() {
    return;
}
```

A returning observer does not cancel a task or race a second lock. It changes
the state that gives the old task permission to act. The timer can wake up,
notice that history moved on without it, and quietly leave.

This is a lot of care for an ASCII creature wearing a propeller hat. Death is
the main feature. It should at least be correct.

## Death has to mean death

Each creature is rolled from a seed when a new observation begins. It might be
a cat, duck, ghost, blob, owl, or robot. Rarity can add a crown, halo, wizard
hat, or other deeply important distinction. One percent are shiny.

The seed makes the roll deterministic. The database stores the life at birth,
including its species, rarity, birth time, and eventual peak observer count.
When the grace period expires, that same row gets a death time. The graveyard
is not generated from browser state or a recent-events cache. Those lives
existed, and then they ended.

That raised an awkward infrastructure question: what happens if the apparatus
itself restarts?

Pretending the creature stayed alive while the only process capable of
observing it was offline felt dishonest. Resurrecting it at startup felt worse.
So the server reconciles every unfinished database row when it boots:

```sql
UPDATE lives
SET died_at = ?
WHERE died_at IS NULL
```

An interrupted life goes to the graveyard. The apparatus does not get special
permission to avoid the rule.

That also made deployment slightly tense. Restarting the service is not merely
restarting a process. If a creature is alive, the deployment kills it. I
deployed the first release declaratively through NixOS on my server, Pond, with
the SQLite file living outside the release package. Future binaries can change.
The graveyard stays.

## It remembers that you left

There is a mean version of this project where you return to a new creature and
never learn what happened to the old one.

I did not want that.

The browser remembers the ID of the last life it observed in `localStorage`.
When the tab becomes visible again, it checks the current state before opening
a new observation. If that life is now in the graveyard, the page shows a
memorial:

> Life #12 died while you were away.

You see its species, rarity, and peak observation count. Then you can choose to
open the box again.

The server does not know who you are. The memorial is entirely local. It only
knows that this browser looked at one life, went away, and came back after that
life ended.

That small pause changes the return from a refresh into a consequence.

## The domain did its part

The application was running before the domain admitted it.

I published a date-versioned Linux binary through GitHub Actions, updated my
`pond-nix` configuration to download that exact release, rebuilt the server,
and confirmed the health endpoint:

```json
{"status":"ok"}
```

Then `schrodingers.life` kept resolving to name.com's parking server.

For a little while, the observation apparatus was online at Pond, Caddy was
ready to proxy it, and the public internet was still staring at
`91.195.240.94`. Let's Encrypt followed DNS to the parking page, failed its
challenge, and Caddy waited to try again. The browser responded with the
comforting message:

> The content of the page cannot be displayed.

The new A record was correct. The old answer was merely cached. DNS eventually
moved, Caddy got its certificate, and the box became reachable.

I had just built a website whose life depends on being observed, then spent its
first few minutes unable to observe it because DNS had not decided where it
lived yet.

Fair enough.

## The social experiment

The site has no chat, user profiles, teams, achievements, or ownership. It does
not say who the observers are. It shows only how many people are currently
looking and the highest number who ever looked at that life at once.

There is a lifetime record, because people need at least one number to become
unreasonable about.

I am curious what happens next.

Will somebody leave a tab visible overnight to protect a rare owl? Will a group
organize shifts around a creature that has survived for a week? Will someone
deliberately close the final tab to put a record holder in the graveyard? Does
keeping it alive feel like care, or eventually like captivity?

The mechanics do not assign a moral answer. They just make every visitor part
of the outcome.

A normal website treats attention as a metric. More page views, more sessions,
more time on site. This one treats attention as the condition for existence.
Your presence does not increase a chart somewhere. It keeps one shared thing
alive.

And leaving is not neutral.

## Open the box

I do not know whether people will keep the creatures alive or kill them for
fun. Both seem plausible. The interesting part is that the application is too
small to hide the choice behind anything else.

Open the page and you are observing.

Close it and, if nobody else is there, the countdown starts.

That is enough machinery for a social experiment. A WebSocket, a mutex, a
SQLite row, thirty seconds of uncertainty, and a graveyard that does not
forget.

Open the box: [schrodingers.life](https://schrodingers.life)

Source:
[github.com/ducks/schrodingers-life](https://github.com/ducks/schrodingers-life)
