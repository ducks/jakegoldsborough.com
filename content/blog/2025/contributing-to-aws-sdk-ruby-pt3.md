---
title: 'AWS SDK Ruby Part 3: When "Working as Intended" Means "Broken by Design"'
date: '2025-10-14'
description: The conclusion to the AWS credential chain saga, where maintainers close a valid bug report, the feature remains broken, and we learn about the politics of backward compatibility in open source.
taxonomies:
  tags:
    - aws
    - ruby
    - oss
---

### The Saga Continues

If you've been following along ([Part
1](/blog/2025/contributing-to-aws-sdk-ruby/) and
[Part
2](/blog/2025/contributing-to-aws-sdk-ruby-pt2/)),
you know I've been on a journey fixing AWS SDK Ruby credential handling. First
I added the missing `credential_source = Environment` implementation, then I
discovered it didn't actually work due to credential chain precedence issues.

After extensive testing and code analysis, I submitted [PR
#3303](https://github.com/aws/aws-sdk-ruby/pull/3303) with a fix. The
maintainer initially responded positively:

> "Hey, thanks for opening an issue. I believe you are correct and this is
something we need to fix."

Great! But then...

### The Reversal

After I provided detailed testing comparing AWS CLI behavior, demonstrated the
fix working in production, and showed exactly which code was unreachable due to
the chain precedence, the maintainer walked it back:

> "From what I understand, I think the default chain will try to resolve
credentials as quickly as possible, so if environment variables are set it will
use them directly instead of using them as a credential source. We try not to
change the behavior of the default chain since returning credentials in a
different order can break many customers."

And then closed both the issue and PR.

### Why This Is Wrong

**1. The Feature Is Completely Broken**

When you configure:
```ini
[default]
role_arn = arn:aws:iam::123456789012:role/MyRole
credential_source = Environment
```

What happens?
1. `env_credentials` (position 7) finds `AWS_ACCESS_KEY_ID` and
   `AWS_SECRET_ACCESS_KEY`
2. Chain returns those credentials and stops
3. `assume_role_credentials` (position 10) never executes
4. The `role_arn` and `credential_source` configuration is **completely
   ignored**

The maintainer confirmed this: "All of the `static_profile_` methods handle
credentials resolution when a client is configured explicitly with a profile."

So the feature works... but only if you don't use the credential chain, which
defeats the entire purpose of having a credential chain.

**2. The Code Contradicts Their Argument**

Look at
[`shared_config.rb:392-400`](https://github.com/aws/aws-sdk-ruby/blob/version-3/gems/aws-sdk-core/lib/aws-sdk-core/shared_config.rb#L392-L400):

```ruby
def credentials_from_source(credential_source, config)
  case credential_source
  when 'Ec2InstanceMetadata'
    # ...
  when 'EcsContainer'
    # ...
  when 'Environment'
    creds = Credentials.new(
      ENV['AWS_ACCESS_KEY_ID'],
      ENV['AWS_SECRET_ACCESS_KEY'],
      ENV['AWS_SESSION_TOKEN']
    )
    creds.metrics = ['CREDENTIALS_ENV_VARS']
    creds
  end
end
```

This code exists specifically to use environment variables as source credentials
for role assumption. But the credential chain prevents it from ever executing
when using the default profile.

**3. The Workaround Proves It's Broken**

The maintainer suggested: "if specifying the profile resolves your issue I
would recommend doing that."

But that's not a solution, it's an admission the feature is broken. The
credential chain exists so you DON'T have to explicitly pass `profile:`
parameters everywhere. Setting `AWS_PROFILE=default` or using the default
profile should work. That's the entire design philosophy.

**4. Who Would This "Break"?**

The maintainer worried about "breaking many customers." But let's think about
this:

My fix only affects users who have **both** of these conditions:
- A profile with `role_arn` AND `credential_source = Environment`
- Environment variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set

If someone configures both, they're explicitly declaring: "use these
environment variables AS SOURCE CREDENTIALS to assume this role."

Who would configure this and expect it to be ignored? That's not a customer
being protected, that's a broken feature being excused.

### What I Did Instead

Since the AWS team won't fix the credential chain, I worked around it by
explicitly passing the `profile:` parameter to AWS SDK clients. This bypasses
the broken credential chain entirely.

The approach is simple:

```ruby
def aws_client_options
  opts = { region: config.region }

  # Explicitly pass profile if configured
  if config.profile.present?
    opts[:profile] = config.profile
  elsif config.access_key_id.present? && config.secret_key.present?
    opts[:access_key_id] = config.access_key_id
    opts[:secret_access_key] = config.secret_key
  end
  # Otherwise omit credentials, let SDK auto-discover

  opts
end
```

With AWS config:

```ini
[profile app-uploads]
role_arn = arn:aws:iam::123456789012:role/AppUploads
credential_source = Environment
```

This works because explicitly passing `profile:` to the SDK bypasses the broken
credential chain and goes directly to the profile-based role assumption code.
It's not fixing the SDK bug, but it enables working role assumption with
temporary credentials instead of long-lived static keys.

### What I Learned (The Hard Way)

**Open source maintainers aren't always right.** Even when they're from AWS,
even when they're maintaining critical infrastructure, they can make bad
decisions.

**Document your wins even when they don't get merged.** This fix works in
production. Other developers will hit this same issue. Having a public record
of the problem and solution helps everyone.

**The bug report itself has value.** Even though they closed it, the issue and
PR document exactly what's broken and why. Future developers will find it and
understand they're not crazy. The feature really is broken.

### The Bigger Picture

This experience reminded me technical correctness doesn't always win.

I had:
- Clear reproduction steps
- Root cause analysis with line numbers
- A working fix with tests
- Production validation
- Comparison with AWS CLI behavior
- Maintainer acknowledgment that it was broken

And they still closed it.

Sometimes the politics of "don't change anything" beat "fix the broken
feature." That's frustrating, but it's reality.

### For Other Contributors

If you hit this issue:
1. Yes, `credential_source = Environment` is broken with the default credential
   chain
2. No, it's not you, it's the SDK
3. The workaround is explicitly passing `profile:` to clients (or using
   `source_profile` with plaintext keys)
4. Explicitly passing the profile parameter bypasses the broken chain and
   enables proper role assumption

For AWS maintainers reading this:
- You have unreachable code in `credentials_from_source`
- Your credential chain prevents documented features from working
- "Breaking changes" is a poor excuse for not fixing broken features
- The feature is already broken for everyone using default profiles

### The End (For Now)

This is where the story ends. I found a workaround, documented it for others,
and moved on.

Sometimes that's all you can do. Sometimes "no" from maintainers means finding
another path. Sometimes proving you're technically correct doesn't matter if
the project isn't willing to fix their bugs.

But hey, at least the deployment works now. And maybe this blog series will
help the next developer who hits this same wall and wonders why a documented
feature doesn't actually work.

The adventure is over. The bug remains. The workaround persists.

Such is open source.
