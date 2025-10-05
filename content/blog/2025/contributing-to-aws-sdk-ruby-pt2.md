+++
title = "Going off the Rails on the AWS Credential Chain"
date = 2025-10-04
[taxonomies]
tags = ["aws", "ruby", "oss"]
+++


### The Plot Twist

Remember that [AWS SDK
contribution](https://jakegoldsborough.com/blog/2025/contributing-to-aws-sdk-ruby/)
I wrote about? The one where I fixed missing `credential_source = Environment`
support? Well, turns out that was only half the story.

After my PR got merged and we updated our Discourse deployment to `aws-sdk-core
3.233.0`, I was excited to finally see role assumption working. The missing
credential source was fixed, our config looked perfect, and all the unit tests
were passing.

But when I deployed it to our test cluster, I still got an error. It was a new
error, but an error nonetheless. Instead of `UnsupportedCredentialType`, I was
now getting a permission denied error when trying to use AWS S3 operations.

### The Real Problem

Here's what was happening. I'd check the identity in our Rails console:

```ruby
discourse(prod)> sts = Aws::STS::Client.new
discourse(prod)> puts sts.get_caller_identity.arn
arn:aws:iam::123456789012:user/MyUser
```

That should have been showing an assumed role ARN like:

```
arn:aws:iam::123456789012:assumed-role/MyRole/session-name
```

The SDK was still using environment variables directly instead of using them as
source credentials to assume the configured role.

### The Investigation (Round 2)

Back to the AWS SDK source code, this time looking at
`credential_provider_chain.rb`. And there it was - a classic ordering problem:

```ruby
def providers
[
# ... other providers ...
[:env_credentials, {}], # Position 7 ← Wins!
# ... other providers ...
[:assume_role_credentials, {}], # Position 10 ← Never reached
]
end
```

The credential chain finds `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in
position 7, returns those credentials immediately, and never reaches the role
assumption logic at position 10.

But here's the thing - this isn't as simple as just moving
`assume_role_credentials` higher in the chain. That might break existing
behavior for thousands of applications that rely on direct environment variable
usage.

### The Real Architecture Problem

What should happen with this config:

```ini
[default]
role_arn = arn:aws:iam::123456789012:role/MyRole
credential_source = Environment
role_session_name = test-session
region = us-west-2
```

**Expected flow:**
1. SDK sees `role_arn` + `credential_source = Environment`
2. SDK uses `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` as **source credentials**
3. SDK calls `AssumeRole` with those source credentials
4. SDK returns **assumed role credentials**

**Actual flow:**
1. SDK finds `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in environment
2. SDK returns those credentials directly (chain stops)
3. Role assumption config is never processed

### The Contribution

I filed [Bug #3301](https://github.com/aws/aws-sdk-ruby/issues/3301) with:

- Clear reproduction steps
- Root cause analysis pointing to the specific code location
- Expected vs. actual behavior with ARN examples
- A workaround using `source_profile` (though it requires plaintext keys)

### The Response

The AWS team's response was exactly what you hope for:

> "Hey, thanks for opening an issue. I believe you are correct and this is
> something we need to fix. I need to confirm some details regarding
> AssumeRoleCredentials profile chaining with the team first and I'll keep you
> updated."

That's maintainer validation that this is a real architectural issue, not user
error.

### What I Learned (Again)

**Complex systems have complex bugs:** My first fix solved the missing feature,
but revealed a deeper architectural problem with credential chain precedence.

**Sometimes the obvious fix isn't right:** Moving `assume_role_credentials`
higher might seem simple, but it requires careful consideration of context and
backward compatibility.

**Good bug reports matter:** Clear reproduction steps, root cause analysis, and
concrete examples help maintainers understand and prioritize issues.

**Persistence pays off:** I could have stopped after the first fix and lived
with workarounds. But pushing deeper led to identifying a more fundamental
issue.

### The Bigger Picture

This experience reinforced something important about systems work: fixing one
layer often reveals problems in the next layer down.

The first bug was a missing feature - straightforward to implement. The second
bug is an architectural design issue that requires careful consideration of how
credential resolution should work when role assumption is involved.

Both bugs are real, both needed fixing, and both will help developers who hit
the same issues. But they required completely different approaches - one needed
code, the other needed a thoughtful design discussion with the maintainers.

### Status Update

As of this writing, the AWS team is discussing the fix for the credential chain
precedence issue. Our Discourse implementation is ready to go - we're just
waiting on the upstream architectural fix.

Sometimes the best contribution you can make is clearly identifying and
documenting a problem, even when the solution isn't obvious. That's exactly
what happened here.

The adventure continues...
