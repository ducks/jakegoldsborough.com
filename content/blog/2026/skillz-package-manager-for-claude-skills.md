---
title: "skillz: A Package Manager for Claude Code Skills"
date: 2026-03-30
description: "Claude Code has a skill system. There's no package manager for it. So I built one. 200 lines of Rust, installs from GitHub, published to crates.io."
taxonomies:
  tags:
    - rust
    - cli
    - tools
    - ai
---

Claude Code lets you write custom skills. Drop a `SKILL.md` file in `~/.claude/skills/` and Claude can invoke it. Skills are just markdown files with instructions for Claude to follow.

The problem: there's no distribution mechanism. Someone publishes a useful skill to GitHub. You want to use it. Your options are: clone the repo, copy the files, symlink manually, or write a script.

That's skillz. Install skills from GitHub with one command.

## Usage

```bash
# Create a new skill from template
skillz new my-skill

# Search for skills on GitHub
skillz search "daily notes"

# Install from GitHub
skillz install github:user/repo

# Install from a URL
skillz install https://github.com/user/repo

# List installed skills with sync timestamps
skillz list

# Update a specific skill
skillz update repo

# Update all skills
skillz update

# Auto-sync on startup (quiet mode for scripts)
skillz update --auto

# Remove a skill
skillz remove repo

# Configure install location
skillz config set skills-dir ~/.dotfiles/claude/skills
```

Skills install to `~/.claude/skills/` by default. Claude Code reads from there automatically. Change the location if you keep skills in dotfiles.

## How It Works

A skill repository needs a `SKILL.md` file. That's it. No manifest, no metadata, no version field. The file defines what the skill does.

skillz supports two layouts:

1. **Flat layout**: `SKILL.md` at the repository root (standard skills)
2. **Plugin layout**: `skills/*/SKILL.md` (Claude Code `.claude-plugin` directory structure)

The flat layout takes precedence if both exist. This means skillz can install both standalone skills and full Claude Code plugins that include multiple skills in the `skills/` directory.

When you run `skillz install github:user/repo`, it:

1. Clones the repository to a temp location
2. Verifies `SKILL.md` exists (checks both layouts)
3. Runs validation checks
4. Moves the repo to `~/.claude/skills/repo`
5. Removes the `.git` directory
6. Records the install in the registry

If `SKILL.md` isn't found in either location, the install fails. Everything else is optional. If there's a `README.md`, it comes along. If there are helper scripts, they come along. The only requirement is that markdown file.

## Why Not Just Clone?

You could `git clone` skills manually. That works. But then:

- You manage paths yourself
- You remember where each skill came from
- You track which repos you've cloned vs symlinked
- You handle updates by pulling or re-cloning
- There's no list of what's installed

skillz solves the boring part: keeping skills in a standard location, tracking what you installed, removing cleanly when you're done.

## Tracking and Updates

skillz maintains a registry at `~/.config/skillz/registry.toml` that tracks:

- Source URL for each skill
- Installation timestamp
- Last sync timestamp

When you run `skillz list`, you see when each skill was installed and last updated:

```
Installed skills in /home/user/.claude/skills:

  daily-notes - https://github.com/user/daily-notes
    installed: 2026-03-25  |  last synced: 2026-03-30

  api-docs - https://github.com/user/api-docs
    installed: 2026-03-28  |  last synced: 2026-03-28
```

Running `skillz update` pulls the latest version from GitHub and updates the sync timestamp. Update a specific skill or update all at once.

## Skill Validation

Every install and update runs validation checks:

**Basic checks:**
- SKILL.md exists
- Valid UTF-8 encoding
- Non-empty content
- Contains markdown headings
- File size under 1MB (warns if larger)

**Malicious command detection:**

skillz scans for dangerous patterns and warns before installation:
- Destructive rm commands (`rm -rf /`, `~`, `*`)
- Pipe to shell from internet (`curl | bash`, `wget | sh`)
- Fork bombs
- Disk fill operations (`dd if=/dev/zero`)
- Dangerous permissions (`chmod 777`)
- System file modifications (`/etc/`, `/bin/`)
- Crypto mining indicators
- Network listeners
- `eval` with variable expansion
- `sudo` without explanation

If validation warnings appear during install, you're prompted to continue or cancel. Updates show warnings but proceed automatically.

Example:

```
Validation warnings:
  ⚠ Line 23: Potentially dangerous command: rm -rf * (Attempts to delete all files recursively)
  ⚠ Line 45: sudo command without explanation - verify this is necessary

Proceed with installation? The skill will still work, but you should review these warnings.
Continue? [y/N]
```

This won't catch everything, but it filters obvious red flags.

## Creating Skills

`skillz new` scaffolds a new skill repository:

```bash
skillz new my-skill
```

This creates:
- `SKILL.md` with template sections (what it does, usage, instructions, examples)
- `README.md` with installation instructions
- `.gitignore`
- Initialized git repository

After creating, edit `SKILL.md` with your skill prompt, commit to GitHub, and install with `skillz install github:username/my-skill`.

## Searching for Skills

`skillz search` queries GitHub for Claude Code skills:

```bash
skillz search "daily notes"
skillz search automation
```

Results are sorted by stars and include repository descriptions and install commands. The search uses GitHub's repository API (no authentication required, though you can set `GITHUB_TOKEN` for higher rate limits).

## Configuration

Config lives at `~/.config/skillz/config.toml`:

```toml
skills_dir = "~/.claude/skills"
```

Change `skills_dir` if you sync skills via dotfiles or want them elsewhere. The path expands `~` correctly.

## Publishing

The package is on crates.io as `skillz-rs` (the name "skillz" was taken). The binary is still called `skillz`.

```bash
cargo install skillz-rs
```

That gets you the CLI. No runtime dependencies, no config required. If you have Claude Code installed, skillz works.

## Why Rust

I wanted a single static binary with no dependencies. The tool does file operations, runs git commands, and calls GitHub's API. Rust's standard library handles all of that. No external HTTP clients needed—curl does the GitHub requests.

The codebase is compact:

```
src/
├── main.rs        # CLI and command dispatch
├── config.rs      # TOML config management
├── registry.rs    # Skill tracking
├── install.rs     # GitHub cloning
├── update.rs      # Skill updates
├── search.rs      # GitHub API search
├── new.rs         # Skill scaffolding
└── validate.rs    # Validation and malicious command detection
```

Clap handles the CLI. The rest is file operations and process spawning.

## What It Doesn't Do

skillz doesn't:
- Manage dependencies between skills
- Host a centralized registry (uses GitHub directly)
- Track semantic versions (uses timestamps)
- Execute skills (that's Claude Code's job)

It solves distribution: creating, finding, installing, and updating skills. Everything else is out of scope.

## The GitHub Release Workflow

The release process runs through a Makefile:

```bash
make release
```

That:
1. Bumps the version to today's date (`YYYYMMDD.0.X`)
2. Creates a release branch
3. Merges to main with a tag
4. Pushes to GitHub

GitHub Actions picks up the tag and builds a Linux x86_64 binary. The binary attaches to the release. Users can download it directly or install via cargo.

Publishing to crates.io is separate:

```bash
make publish
```

This was intentional. GitHub releases build binaries. Crates.io distributes source. Keeping them separate means one can fail without blocking the other. If the crates.io publish hits a rate limit, the GitHub release still ships.

## Installing From Source

If you don't want cargo:

```bash
git clone https://github.com/jakegoldsborough/skillz
cd skillz
cargo build --release
./target/release/skillz --help
```

Or use Nix:

```bash
nix-shell
cargo build --release
```

The `shell.nix` includes Rust tooling and git. That's all you need.

## What's Next

The core features are shipping: create, search, install, validate, update, track.

Future versions could add:
- Semantic versioning (instead of timestamps)
- Dependency management (if one skill needs another)
- Rollback to previous versions
- Local path installation (copy instead of clone)

The foundation is working. The rest is iteration.

## Links

- [skillz on GitHub](https://github.com/ducks/skillz)
- [skillz-rs on crates.io](https://crates.io/crates/skillz-rs)
