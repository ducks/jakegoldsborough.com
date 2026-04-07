---
title: "Jobchain: Verifiable Employment Credentials"
date: 2026-04-06
description: "What if your employer signed a machine-verifiable reference letter when you started, not when you left? Jobchain issues W3C Verifiable Credentials with Ed25519 signatures. No blockchain, no platform, no PDF."
taxonomies:
  tags:
    - rust
    - tools
    - specifications
---

[Michał Fita responded to my whoami-spec post](https://hachyderm.io/@michalfita@mastodon.social/116330706279023796) asking about verifiable credentials. His point: we should be able to prove employment history with cryptographic signatures, not chiselled PDFs that ATSes shred back into text.

He was right about the problem. But every previous attempt at this (Blockcerts, LinkedIn verified credentials, W3C VCs) died because it's a three-sided marketplace. Employers have to issue credentials. Employees have to hold them. ATSes have to consume them. Nobody wants to go first.

I built the tooling anyway.

## The Problem

The employment verification pipeline is absurd:

1. You write a resume (self-attested, no proof)
2. You export to PDF (formatting lottery)
3. An ATS OCRs it back to text (lossy, error-prone)
4. A background check company calls your old employer (slow, expensive)
5. Someone confirms dates over the phone (binary pass/fail)

Every step degrades information. The structured data you started with becomes an unstructured phone call. There has to be a better way.

## The Fix

Public key cryptography. Same thing that makes HTTPS work.

Your employer has a keypair. They sign a JSON document saying you worked there. Anyone can verify the signature by checking the public key hosted on the employer's domain.

No blockchain. No platform. No account to create. DNS is the trust anchor.

## How It Works

Three commands:

### 1. Employer creates an identity

```bash
$ jobchain init --org "Discourse" --domain discourse.org

Initialized jobchain identity for Discourse
  DID: did:web:discourse.org
  Next: host did.json at https://discourse.org/.well-known/did.json
```

This generates an Ed25519 keypair and a [DID document](https://www.w3.org/TR/did-core/). The public key lives at a well-known URL on the company's domain. If you control `discourse.org`, you control the identity. No certificate authority, no third party.

### 2. Employer issues a credential

```bash
$ echo '{"title":"Infrastructure Engineer","company":"Discourse","start":"2024-03"}' \
  | jobchain issue --domain discourse.org

{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "EmploymentCredential"],
  "issuer": "did:web:discourse.org",
  "credentialSubject": {
    "type": "EmploymentRecord",
    "title": "Infrastructure Engineer",
    "company": "Discourse",
    "start": "2024-03"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "proofValue": "z4jH8n..."
  }
}
```

That's a [W3C Verifiable Credential](https://www.w3.org/TR/vc-data-model/). Structured JSON, signed with Ed25519. Hand the `.vc.json` file to the employee.

### 3. Anyone verifies

```bash
$ jobchain verify --input jake-discourse.vc.json

VALID -- credential signature verified
  Issuer:  did:web:discourse.org
  Subject: Infrastructure Engineer at Discourse
  Issued:  2026-04-02
```

The verify command fetches the public key from `discourse.org/.well-known/did.json` and checks the signature. No account needed. No API key. Just math.

## The Wallet Is a Git Repo

Your "wallet" is a folder of `.vc.json` files. Host it anywhere. GitHub Pages, Netlify, your own server.

```bash
$ jobchain wallet build --dir ./credentials --out ./site
```

This generates an HTML site with your credentials and a machine-readable `index.json` manifest. Hiring managers see a clean page. ATS systems consume structured JSON. Same data, two views.

The wallet is static files. Push to a repo, deploy to Pages. Done.

## Why Not Blockchain

This comes up immediately, so let me address it.

Blockchain solves one problem jobchain doesn't: persistence after the issuer disappears. If `discourse.org` goes dark, the public key is gone and nobody can verify old credentials.

But blockchain adds massive complexity for that edge case. Consensus mechanisms, gas fees, infrastructure dependencies. And the social problem (getting employers to issue credentials) doesn't change regardless of the storage layer.

For now, DNS is the trust anchor. If persistence matters later, there are simpler solutions: key archival services, IPFS pinning, or embedding the public key in the credential itself.

## Amendments

Credentials aren't static. You get promoted. You change teams. Jobchain supports amendments: signed updates linked to the original credential via content hash.

```bash
$ jobchain amend --credential jake-discourse.vc.json \
    --domain discourse.org \
    --patch '{"title":"Senior Infrastructure Engineer"}' \
    --effective-date 2025-06
```

Each amendment is independently verifiable. The chain forms a linked list: original credential, then amendments, each signed and hash-linked to its predecessor.

## What This Is Not

It's not a platform. There's no service to sign up for, no data to hand over.

It's not self-attested. Only the employer's private key can produce a valid signature.

It's not a resume replacement. [JOBL](https://jobl.dev) handles the self-authored resume. Jobchain handles what others can confirm about you. They complement each other.

## The Architecture

Jobchain is a Cargo workspace with three crates:

- **jobchain-core**: credential types, Ed25519 signing, DID documents, amendment chains
- **jobchain-verify**: signature verification only, kept slim for future WASM compilation
- **jobchain-cli**: the `jobchain` binary

131 tests. All passing.

The verify crate is deliberately lightweight. No HTTP client, no file I/O, no CLI dependencies. The plan is to compile it to WASM so the wallet can verify credentials in-browser without a server.

## What I Actually Used to Build This

I used [finna](/blog/2026/finna-multi-model-spec-implement/) to architect and implement it. Claude and Gemini debated the architecture, generated 16 implementation specs, then Claude implemented each spec as a feature branch. The whole thing -- keypair generation, DID documents, credential signing, verification, amendments, adapter traits, wallet generator, CLI, 131 tests -- was implemented in one session.

I reviewed the output, fixed a few things, and it worked end to end. That's a different kind of project kickstart than I'm used to.

## The Hard Part

The tooling exists. The hard part is adoption.

Someone has to go first. An employer has to host a `did.json` and issue a credential. An employee has to publish their wallet. A hiring manager has to check it.

I work at a smaller company. We could try it. The ask is small: host one JSON file, run one command when someone joins or leaves. Frame it as a signed reference letter that's machine-verifiable.

That's the next step.

## Current Status

Working CLI with all Phase 1 features:
- `jobchain init` -- generate org identity
- `jobchain issue` -- sign employment credentials
- `jobchain verify` -- check signatures (offline or via DID resolution)
- `jobchain amend` -- signed amendments to existing credentials
- `jobchain wallet build` -- static site generator

What's missing:
- Actual adoption by an employer
- HR tool adapters (BambooHR, Gusto, etc.)
- WASM verification in the wallet
- A real-world credential issued by a real company

The infrastructure is there. Now it needs to be used.

## Links

- [Jobchain on GitHub](https://github.com/ducks/jobchain)
- [Jobchain Documentation](https://ducks.github.io/jobchain/) -- implementation guide and spec
- [JOBL](https://jobl.dev) -- structured resume format (companion project)
- [whoami-spec](https://github.com/ducks/whoami-spec) -- declarative identity
- [finna](https://github.com/ducks/finna) -- multi-model debate and implement
