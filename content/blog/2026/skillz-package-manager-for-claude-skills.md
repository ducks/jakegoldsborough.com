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

Claude Code has a skill system. You write a markdown file with instructions, drop it in `~/.claude/skills/`, and Claude learns a new workflow. The skill persists across sessions. You don't re-paste prompts every time.

The problem: there's no way to share skills. Someone builds a useful skill (daily notes, API doc generation, database migrations). You want it. Your options: clone the repo, copy files manually, symlink, write a script to manage it.

That's why I built skillz. It's a package manager for Claude Code skills. Install from GitHub, track updates, share your own.

## What is a Skill?

A skill is a markdown file that tells Claude Code how to perform a specific task. When invoked, Claude reads the skill file and follows its instructions.

Example skill (`daily-notes/SKILL.md`):

```markdown
# Daily Notes Skill

Generate a daily note with structured sections.

## Instructions

When the user invokes this skill:

1. Get today's date in YYYY-MM-DD format
2. Create a file at `~/notes/YYYY/YYYY-MM-DD.md`
3. Add these sections:
   - ## Tasks
   - ## Meeting Notes
   - ## Ideas
4. Confirm the file was created

## Usage

User says: "create today's note"
You respond by creating the structured markdown file.
```

That's it. Skills are prompts, but packaged for reuse. Claude Code loads all skills from `~/.claude/skills/` on startup. When you ask Claude to "create today's note", it knows how to do it.

Skills vs alternatives:
- **Prompt libraries**: Skills live in your filesystem, Claude loads them automatically
- **Copy/paste snippets**: Skills persist across sessions, no need to re-paste
- **Claude Projects**: Projects are context, skills are executable workflows

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

You could `git clone` skills manually. Or use Claude Projects. Or maintain a prompt library. Why skillz?

**vs manual git clone:**
- skillz tracks what's installed and where it came from
- Updates are `skillz update`, not `cd ~/.claude/skills/foo && git pull`
- Consistent paths, clean uninstall

**vs Claude Projects:**
- Projects are context (files, notes, docs)
- Skills are executable workflows
- Skills work across all conversations, not just one project

**vs prompt libraries:**
- Prompt libraries require copy/paste every session
- Skills load automatically on Claude Code startup
- Skills can include helper scripts and templates

skillz solves distribution and lifecycle management. Everything else is out of scope.

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

## Full Example: Installing and Using a Skill

Find a skill:

```bash
$ skillz search "daily notes"
Found 3 skill repositories:

  alice/daily-journal - ⭐ 24
    Automated daily note generation with templates
    https://github.com/alice/daily-journal
    Install: skillz install https://github.com/alice/daily-journal
```

Install it:

```bash
$ skillz install github:alice/daily-journal
Cloning repository...
Validating SKILL.md...
✓ Installed daily-journal to ~/.claude/skills/daily-journal
```

Now restart Claude Code (or it loads on next session). Ask Claude:

```
You: "create today's daily note"
Claude: I'll create your daily note using the daily-journal skill.
        Created: ~/notes/2026/2026-03-30.md with task, meeting, and ideas sections.
```

The skill taught Claude a new workflow. No copy/paste, no re-explaining. It just works.

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

## Skill Structure Reference

A valid skill repository contains:

**Required:**
- `SKILL.md` - The skill prompt

**Optional:**
- `README.md` - Installation/usage docs for humans
- Helper scripts (e.g., `generate-report.sh`)
- Templates or data files

The `SKILL.md` format is freeform markdown. Common patterns:

```markdown
# Skill Name

Brief description.

## Instructions

Step-by-step instructions for Claude to follow.

## Usage

Example invocations that trigger this skill.

## Examples

Input/output examples.
```

No JSON schema, no version field, no manifest. Just markdown. Claude reads it, follows it.

## What This Actually Solves

skillz is not about prompts. It's about infrastructure for reusable AI workflows.

Skills are prompts, but:
- They persist across sessions
- They compose (one skill can reference another)
- They version (via git)
- They distribute (via GitHub)

This is package management for AI instructions. The same way you `npm install` a library instead of copying code, you `skillz install` a workflow instead of re-pasting prompts.

skillz handles distribution. Claude Code handles execution. Together, they make AI workflows shareable.

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

The core loop works: create, search, install, update. What's missing:

- Dependency resolution (skill A requires skill B)
- Rollback to previous versions

The foundation is solid. Now it's about making skills composable.

If you build skills, publish them to GitHub. If you use skills, install with skillz. The ecosystem grows when workflows are shareable.

## Links

- [skillz on GitHub](https://github.com/ducks/skillz)
- [skillz-rs on crates.io](https://crates.io/crates/skillz-rs)
