+++
title = "Building a Fully Decentralized Voting System Using Just Git and Pull Requests"
date = 2025-06-23
[taxonomies]
tags = ["rust", "git", "devops"]
+++

### The Premise

What if we could build a fully transparent, auditable, and tamper-evident
voting system -- without any servers, centralized backend, or traditional
databases?

The result is **GitVote** - a simple but powerful decentralized voting system
that uses nothing but Git, pull requests, and a little bit of Rust.

### Why Git?

Git already gives us:
- A fully distributed ledger
- Immutable commit history
- Branching and merging workflows
- Forking for isolated participant actions
- Cryptographic integrity through hashes and signatures

With all that, we're part of the way to a blockchain.

I wondered if I could build a voting system where Git itself is the storage
layer, the consensus layer, and the audit trail.

### The Design

At a high level, GitVote works like this:
- **Proposals** are created as dedicated Git branches
- **Votes** are submitted as files inside pull requests.
- **Voter ID** is tied to each voter's Git configuration (name and email)
- **Duplicate Voting** is automatically prevented via CI checks
- **Immutable blocks** are built from merged votes using deterministic hashing
- **Tally results** can be generated entirely offline from the final ledger

There's no central database, API server, or backend. Everything happens inside
of Git.

### The Voting Flow

#### Proposal Creation

Each new proposal is created as a new Git branch, for example:

`proposal/001-color-vote`

A simple `schema.json` file defines the allowed choices for that proposal:

```
{
  "allowed": ["blue", "purple", "green"]
}
```

#### Voter Submission

Voters follow this flow:
1. Fork the governance repo
2. Clone their fork locally
3. Checkout the correct proposal branch
4. Run GitVote CLI tool to cast their vote:
`gitvote cast --choice purple`

This will:
- Write a new vote file into `votes/` (one file per voter)
- Commits the vote using their Git identity
- Signs the commit (GPG coming soon)
- Prepares the branch for submission

5. Push their branch back to their fork
6. Open a pull request into the upstream proposal branch

#### Vote Validation

Every pull request triggers CI which runs:
`gitvote validate`

This will validate:
- The vote file format
- Compliance with the allowed schema
- No duplicate voters (one voter, one vote)

Invalid votes fail the CI and will not be merged

#### Merging & Chain Building

Once a valid PR is merged, CI will automatically run:
`gitvote build-chain`

This scans all merged vote files and creates an immutable hash-linked chain
of blocks stored as plain JSON:

```
blocks/
  block-0000.json
  block-0001.json
  ...
```

Each block includes:
- The vote choice
- The voter identity
- The original timestamp of the vote
- The Cryptographic hash linking it to the previous block

#### Tallying Votes

At any time, anyone can run:
`gitvote tally`

This reads the `blocks/` directory and generates a full tally of the current vote
state:

```
Vote Tally:
  purple votes: 3
  red votes: 2
Total unique voters: 5
```

No external system is needed to calculate the results — everything lives
entirely inside Git.

### The Tech Stack

- Rust for the core CLI, `gitvote`
- Github Actions for CI validation and chain building
- Git itself as the distributed backend

### Security

- Voter ID is tied to each user's Git config (`user.name` and `user.email`)
- CI fully enforces schema validation and prevents voter duplication
- All votes are auditable forever via immutable commit history
- The chain is fully deterministic and reproducible offline
- The ledger can be archived back into `main` for permanent recordkeeping

### The Benefits

- **Simplicity:** No central server or complex infrastructure
- **Transparency:** Every vote and rule is visible to all voters
- **Auditability:** Anyone can verify the ledger at any time
- **Offline verifiability:** The full vote chain is just a Git repo

### Future Plans

There are a number of interesting enhancements that could be made here I think:
- GPG signature enforcement
- Anonymous but verifiable voting via zero-knowledge proofs
- Weighted or ranked ballots
- Multi-proposal governance workflow

For now, GitVote is a minimal, functioning, fully decentralized voting system.

### The Code/Demo

You can find the CLI here:
[GitVote CLI](https://github.com/ducks/gitvote)

You can find a test governance repo here:
[gitvote-test](https://github.com/ducks/gitvote-test)

By going to [actions](https://github.com/ducks/gitvote-test/actions), you can
see the various CI workflows that run during the voting process.

- First, I submit a valid vote for **purple**
- Then, I attempt to vote again for **green**, which correctly fails
  due to duplicate voter prevention
- Finally, I simulate a new voter by spoofing a different Git identity (via
  `git config`), submit a vote for **blue**, and the vote passes validation

### Closing Thoughts

What originally started as an idea for "Gitcoin" and wanting to learn more
about blockchains turned into a fully functional, fully auditable governance
platform -- all built entirely on top of Git (and Rust).

It was pretty satisfying to turn pull requests, branch
protections, and hash-linked commits into a simple, verifiable voting process.
