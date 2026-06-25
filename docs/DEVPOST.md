# Vector: Devpost submission

> Try it: https://vector-aabw-six.vercel.app

## Elevator pitch

Vector splits a 5-day AI buildathon into two modes, so a builder only sees the tools that matter right now.

## Inspiration

Every multi-day buildathon has the same blind spots. The schedule is scattered across pages with no single source of truth. Hundreds of builders are in one room and still struggle to find the right people. And when the deadline closes in, the schedule stops mattering and finishing is all that counts.

We have run these events, so we built the tool we always wished attendees had. Vector gives the week one shape, with two modes that follow its two halves. And it makes one quiet problem shared: at a hackathon, you are rarely the only team stuck on a given wall.

## What it does

Vector runs in two modes, one for each half of the event.

**Days 1 to 3, find your way and find your people.**

- A live now-and-next view that always knows where the event is.
- A searchable directory of every session.
- Per-day venue maps.
- A people directory you filter by skills, industry, and intent, with one tap to message or lock in a 15-minute catchup.
- A personal schedule that catches clashes for you.
- A copilot that answers from your own schedule and profile.

**Days 4 to 5, lock in and ship.**

- A deadline guardian: a live countdown and a checklist built from the real submission fields, so nothing slips in the scramble.
- A bottleneck board: every team's blockers in one place, grouped by theme, one tap from the person who can unblock you.

## How we built it

One principle runs through the whole build: do the thinking locally, and use the model only for language. The scheduling, the conflict detection, the countdown, the matching signals, all of it is deterministic and runs in the browser. The model is reserved for the few places where words are the product.

That choice means Vector answers the instant a builder opens it, on any phone, and a full event costs next to nothing to host. The writing features run on built-in responses today, and go live on a real model the day Vector is backed.

## Challenges we ran into

The hardest calls were product calls.

**Matching that could not be gamed.** People began as a ranked, AI-matched list, until we saw the flaw: any visible match score just rewards whoever fills in the most fields. So we let Vector suggest people and leave the call to the human. There is no number to farm.

**Making "I'm stuck" useful.** Builders hit walls constantly, and they hit them privately, so nobody realises six other teams are blocked on the same thing. The hard part was turning a moment people tend to hide into one they would willingly post. We made it a shared board, grouped by theme, where a blocker is one tap from the person who can clear it.

## Accomplishments that we're proud of

- **It gives the week one shape.** Each mode shows only what matters in its half of the event. No hunting for the right tool at the wrong time.
- **It makes being stuck a shared signal.** The bottleneck board turns private blockers into help that finds you.
- **You find your people, fast.** Filter the room to who you want to meet, then reach them in a tap.
- **It is live in the browser now.** Open it on a phone and the full Days 1 to 3 toolkit is there.

## What we learned

- **Visible scores get gamed.** Rank people by a number and they will game the number, not the connection. The fix was to stop ranking.
- **Let AI write, let code decide.** The durable features are the ones where the model handles language and deterministic code handles the rest.
- **Cutting is as important as building.** Dropping the match score left a smaller set that does more of what a builder needs.

## What's next for Vector

Next, before a live deployment:

- Wire the calendar to the live event, so Vector becomes the single source of truth the week is missing.
- Switch the language features onto the funded model path. The product is already built for it, so this is a configuration, not a rebuild.
- Deeper profiles, sharper search, and a richer bottleneck board.

Later, with backing:

- Accounts and persistence, so profiles and activity carry across devices and last the whole week.
- An organiser view: a live read on where teams are stuck and which sessions land. This is what turns Vector from an attendee tool into something the organisers run the event from.

Try it: https://vector-aabw-six.vercel.app

## Built with

React, Vercel, and Claude, used for the language features.
