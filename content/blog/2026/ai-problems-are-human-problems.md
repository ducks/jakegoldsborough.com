---
title: "AI Problems Are Just Human Problems Amplified"
date: 2026-02-23
description: "AI fatigue, perfectionism vs non-determinism, and garbage in/garbage out. These are not new problems. AI just makes them obvious faster."
taxonomies:
  tags:
    - ai
    - tools
    - dev
---

Another day, another article about AI fatigue and all the other problems it
causes. And I agree, the symptoms are real: burnout from keeping up with new
models, FOMO about missing capabilities, perfectionism about getting prompts
exactly right, analysis paralysis about which tool to use.

However, I do not think these are new problems. Developers burned out keeping
up with JavaScript frameworks before AI existed. FOMO about missing the next
big thing has been around since the first tech conference. Perfectionism about
tooling choices is why we have 47 different React state management libraries.

AI did not create these problems. It amplified them. New models ship every
month instead of every year. The output quality depends heavily on prompt
engineering, so perfectionism has visible consequences. The tooling landscape
changes so fast that yesterday's best practice is tomorrow's deprecated
approach.

The solution is the same as it always was: pick something, build with it, move
on. If the tool does not work, try a different one. If the output is wrong, fix
the prompt or fix the output. Stop trying to find the perfect model, the
perfect prompt, the perfect workflow. There is no perfect. There is only good
enough to ship.

## Garbage In, Garbage Out

I spent yesterday implementing a Rails app called Webstead using a multi-model
code generation tool called finna. The tool works like this: multiple LLMs
debate the architecture, synthesize a consensus, generate specs, then implement
the code.

The tool generated migrations with circular dependencies. The `CreateUsers`
migration referenced `websteads` that did not exist yet. The `CreateWebsteads`
migration referenced `users` that did not exist yet. The `CreateFollowers`
migration referenced `federated_actors` with a timestamp 204514 instead of the
correct 000003.

The models also added duplicate indexes, self-referential foreign keys that
caused deadlocks, and CHECK constraints that hung the migration runner.

Was this an AI problem? No. It was a coordination problem. The models generated
migrations independently without seeing what the other models had created.
Dependencies got misordered. Constraints conflicted. The tool did not validate
that migrations could actually run before writing them to disk.

The fix was not better AI. The fix was better constraints. Migrations need
dependency ordering. The tool needs to number them sequentially. If a migration
references a table, that table's migration must run first.

This is the same coordination problem human developers face on multi-person
teams. You just notice it faster when the team is four LLMs running in
parallel.

## What Actually Works

I use AI for code generation daily. Here is what works:

Use it for tasks with clear specifications. If you can describe the desired
output precisely, the model will probably generate something close. If you
cannot describe what you want, the model will not guess correctly.

Review the output. The model will make mistakes. It will use deprecated APIs.
It will skip edge cases. It will generate code that compiles but does not work.
Treat it like code review from a junior developer who types fast but does not
check their work.

Iterate on the prompt when the output is wrong. If it generates migrations with
circular dependencies, tell it to output migrations in dependency order. The
model does not know your requirements unless you tell it.

Use multiple models when the task is ambiguous. Different models have different
blind spots. One model catches precision bugs in number handling. Another
catches stack overflow vulnerabilities in recursive parsers. Consensus finds
edge cases no single model would have caught.

Do not expect the model to read your mind. It cannot. It is text prediction,
not telepathy.

## The Real Problem

The real problem with AI tools is that people expect them to solve problems
humans have not solved yet.

You cannot ask an AI to follow code style if you have not documented the style.
You cannot ask it to implement a feature if you have not specified what the
feature should do.

AI does not eliminate the need for clear requirements, documentation, or code
review. It amplifies the cost of not having them. If your team does not have
coding standards, the AI will generate code in 47 different styles. If your
project does not have tests, the AI will break things you did not know were
fragile. If your specs are ambiguous, the AI will pick the wrong interpretation.

This is not the AI's fault. This is your fault for not having standards, tests,
or specs.

## Using AI Without Losing Your Mind

Here is what I do:

Treat AI as a tool, not a coworker. It does not understand context. It does not
remember what you said three prompts ago. It does not know what you meant
versus what you typed. Give it explicit instructions and check the output.

Use it for tasks with high certainty and low blast radius. Generating test
cases? Great. Refactoring variable names? Fine. Rewriting your entire database
layer? Probably not.

Keep humans in the loop at decision boundaries. Generate the plan, review it,
then execute. Generate the code, review it, then merge. The AI can propose. You
decide.

Do not try to keep up with every new model. Pick one that works and use it
until it does not work anymore. Switching models every week is how you burn
out.

Lower your expectations. The AI will not write production-ready code from a
vague prompt. It will write something that compiles and mostly works. You fix
the rest. That is still faster than writing it yourself from scratch.

## Conclusion

AI problems are human problems. Burnout from keeping up with too many tools.
FOMO about missing the next breakthrough. Perfectionism about getting it
exactly right. Analysis paralysis about which approach to take. Garbage in,
garbage out.

We had these problems before AI. We will have these problems after AI. The only
difference is speed. AI makes bad processes fail faster. It makes unclear
requirements obvious immediately. It makes poor documentation expensive in
minutes instead of months.

If you are struggling with AI tools, the problem is probably not the AI. The
problem is that your process, documentation, or requirements were already
broken. AI just made it obvious.

Fix the process. The AI will follow.
