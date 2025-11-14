---
title: "Building yaml-janitor: Solving the Comment Preservation Problem"
date: 2025-11-14
description: "How I built a YAML linter that preserves comments, validated 1,736 production files, and published it to RubyGems"
taxonomies:
  tags:
    - ruby
    - yaml
    - oss
    - devops
---

For the past five years, there's been an intermittent problem at work:
sometimes, when editing YAML configuration files with automated tools, comments
get destroyed. The comments contain critical context like why certain values
exist or what not to change, so losing them causes real problems when trying to
maintain infrastructure configuration.

A coworker tried to solve this in 2021 by building tooling around
psych-pure, a pure Ruby YAML parser that can preserve comments. But
psych-pure wasn't stable enough at the time, so the project stalled.

Fast forward to 2025, and I happened to be looking through devops topics and
stumbled upon this one. This seemed like the perfect opportunity to revisit the
comment preservation problem.

## The Initial Validation

I started by writing a simple validation script using psych-pure to check
if our production YAML files could survive a round-trip: load the file,
dump it back out, and verify the semantics stayed the same.

```ruby
require 'psych/pure'

yaml_content = File.read('config.yml')
loaded = Psych::Pure.load(yaml_content, comments: true)
dumped = Psych::Pure.dump(loaded)

# Verify semantics match
original_data = Psych::Pure.load(yaml_content)
dumped_data = Psych::Pure.load(dumped)

if original_data == dumped_data
  puts "✅ Semantics preserved"
else
  puts "❌ MISMATCH"
end
```

I ran this against 1,736 production YAML files across two repositories.
The good news: no corrupt YAML! Most files validated successfully, with
only a handful failing due to using patterns that are technically invalid
per the YAML spec (though the C implementation of Psych accepts them
anyway).

## Building yaml-janitor

With validation working, I built a proper linter around psych-pure. The
key challenge was that while psych-pure preserves comments when loading,
its built-in dump function doesn't give enough control over formatting.
I needed custom formatting rules like consistent indentation and compact
array notation.

The solution was to build a custom emitter that walks the loaded data
structure and outputs formatted YAML while preserving all comments:

```ruby
class Emitter
  def initialize(node, config)
    @node = node
    @config = config
    @output = []
  end

  def emit
    emit_comments(get_comments(@node, :leading), 0)
    emit_document(@node)
    @output.join("\n") + "\n"
  end

  def emit_mapping(hash, indent)
    entries = hash.respond_to?(:psych_keys) ?
      hash.psych_keys.map { |pk| [pk.key_node, pk.value_node] } :
      hash.to_a

    entries.each_with_index do |(key, value), index|
      emit_comments(get_comments(key, :leading), indent)
      key_str = scalar_to_string(key)

      case value
      when Hash, Array
        @output << "#{' ' * indent}#{key_str}:"
        emit_node(value, indent + indentation)
      else
        value_str = scalar_to_string(value)
        @output << "#{' ' * indent}#{key_str}: #{value_str}"
      end

      emit_comments(get_comments(key, :trailing), indent)
    end
  end
end
```

This gave me complete control over formatting while preserving every
comment. The emitter handles:

- Consistent indentation (2 or 4 spaces)
- Compact array format (dash on same line as first key)
- Comment placement (leading and trailing)
- Blank lines between top-level sections

## Production Testing

I tested yaml-janitor on a production file with mixed 2-space and 4-space
indentation:

```bash
# Backup original
cp pipeline.yaml /tmp/pipeline_backup.yaml

# Fix with yaml-janitor
yaml-janitor --fix --indentation 2 pipeline.yaml

# Verify semantics preserved
ruby -ryaml -e "
  orig = YAML.load_file('/tmp/pipeline_backup.yaml')
  fixed = YAML.load_file('pipeline.yaml')
  puts orig == fixed ? '✅ Semantics preserved' : '❌ MISMATCH'
"
# Output: ✅ Semantics preserved
```

The fix worked perfectly. Consistent indentation, all comments preserved,
and semantics verified to be identical.

## Configuration System

I added a configuration file system so teams can standardize their YAML
formatting:

```yaml
# .yaml-janitor.yml
indentation: 2
line_width: 80
sequence_indent: false

rules:
  consistent_indentation:
    enabled: true
  multiline_certificate:
    enabled: true
```

The CLI supports both config files and command-line overrides:

```bash
yaml-janitor --config .yaml-janitor.yml files/*.yml
yaml-janitor --fix --indentation 2 config.yml
```

## Publishing to RubyGems

Once the linter was working, I published it to RubyGems so anyone could
use it. I set up automated publishing with GitHub Actions and RubyGems
trusted publishing (no API keys needed):

```yaml
name: Publish to RubyGems
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true
      - uses: rubygems/release-gem@v1
```

The release process is now fully automated:

1. Update version number (date-based: YYYYMMDD)
2. Run `bundle install` to update lockfile
3. Commit and push to main
4. Create and push tag: `git tag v20251113 && git push origin v20251113`
5. GitHub Actions automatically publishes to RubyGems

## Results

yaml-janitor is now published and available on RubyGems:

```bash
gem install yaml-janitor
yaml-janitor --help
```

Production validation results:
- Scanned 1,736 YAML files
- Found 0 corrupt files
- Fixed widespread formatting inconsistencies
- Preserved all comments during fixes

People are already using it to lint their YAML configurations.

## The Five-Year Solution

The problem my coworker identified in 2021 is finally solved. Teams can
now safely automate YAML editing without losing critical context in
comments. The infrastructure was already there, it just needed psych-pure
to stabilize and someone to finish building the tooling.

yaml-janitor is open source and available at
github.com/ducks/yaml-janitor. If you've ever had to choose between
manual YAML editing and losing your comments, check it out.
