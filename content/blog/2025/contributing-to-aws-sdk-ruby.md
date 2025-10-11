---
title: 'Contributing to the AWS Ruby SDK: When Documentation and Implementation Don''t
  Match'
date: '2025-08-23'
description: Discovering and fixing a missing credential source implementation in
  the AWS Ruby SDK where documentation promised Environment support but the code didn't
  deliver.
tags:
- aws
- ruby
- oss
---

### The Problem

I was working on some IAM role configuration at work when our Discourse
deployment started failing with AWS credential errors. The error was
frustrating because according to the AWS documentation, everything should have
been working perfectly.

The deployment was trying to use `credential_source = Environment` in the AWS
config, which is a standard approach documented in the AWS CLI guide. But for
some reason, the Ruby SDK wasn't picking up the credentials.

### The Investigation

Like any good debugging session, I started by tracing through the credential
chain. The AWS Ruby SDK has a pretty clear credential resolution process, so I
dug into the source code to see what was happening.

That's when I found something interesting: the AWS CLI documentation clearly
shows `Environment` as a supported credential source, but when I looked at the
Ruby SDK implementation, that option was completely missing.

Here are the [docs](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html)

Here's what I found in the [SDK](https://github.com/aws/aws-sdk-ruby/blob/version-3/gems/aws-sdk-core/lib/aws-sdk-core/shared_config.rb#L362):

```
case credential_source
  when 'Ec2InstanceMetadata'
    # ... implementation exists
  when 'EcsContainer'
    # ... implementation exists
  when 'Environment'
    # ... nothing here! end
```

The CLI supports it, the documentation says it should work, but the Ruby SDK
just... doesn't implement it.

### The Solution

This felt like a classic case where implementation lagged behind documentation.
Since I needed this working for our deployment, I decided to contribute the
missing functionality back to the project.

The fix was actually pretty straightforward once I understood the pattern:
```
when 'Environment'
  Aws::Credentials.new(
    ENV['AWS_ACCESS_KEY_ID'],
    ENV['AWS_SECRET_ACCESS_KEY'],
    ENV['AWS_SESSION_TOKEN']
  )
```

I added comprehensive tests to make sure it worked correctly and that I wasn't
breaking any of the existing 20,000+ tests in the project.

### The Contribution

[https://github.com/aws/aws-sdk-ruby/pull/3283](https://github.com/aws/aws-sdk-ruby/pull/3283)

Here's the thing - I don't really know Ruby that well. But the codebase was
well-organized and the patterns were clear enough that I could understand what
needed to happen.

I submitted the PR with:

-   The missing implementation
-   Proper test coverage
-   Clear documentation of what was being added

### The Response

The response from the AWS team was exactly what you hope for in open source:

> "Hey, thanks for opening a PR. I agree that we should support this and I may
> make some changes to this PR as well."

That's maintainer gold right there - acknowledgment that the gap was real and
willingness to collaborate on getting it merged.

### What I Learned

This whole experience reinforced a few things for me:

Documentation gaps happen: Even in well-maintained projects like the AWS SDKs,
there can be mismatches between what's documented and what's implemented.

Don't let unfamiliar languages stop you: I was able to contribute meaningfully
to a Ruby project despite not being a Ruby developer. Good code organization
and clear patterns make this possible.

Small changes can have big impact: This was maybe 10 lines of actual code, but
it unblocked our deployment and will help other developers who hit the same
issue.

### The Bigger Picture

This kind of contribution is exactly why I love working as a generalist.
Instead of saying "that's not my language" or "someone else should fix the AWS
SDK," I could trace the problem to its source and ship a fix.

The best part? Our Discourse deployment should work now, and hopefully other
developers won't hit this same roadblock in the future.

### Update

Since writing this, the change has been expanded with additional tests and
[approved by the maintainers](https://github.com/aws/aws-sdk-ruby/pull/3283).
It's really rewarding to see a small contribution grow into something that's
now part of the SDK itself. This is a great reminder that even small fixes
matter -- they can make life easier for the next developer who comes along.
