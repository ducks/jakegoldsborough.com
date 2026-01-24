---
title: "How Jennifer Aniston and Friends Cost Us 377GB and Broke Linux Hardlinks"
date: 2026-01-23
description: "A backup deduplication fix, filesystem hardlink limits, and the Jennifer Aniston reaction GIF that stress-tested our infrastructure."
taxonomies:
  tags:
    - discourse
    - infrastructure
    - linux
---

## Intro

It started with backup issues. Sites with hundreds of gigabytes of uploads
were running out of disk space during backup generation. One site had 600+ GB
of uploads and the backup process kept dying.

We run backup generation for Discourse sites, some with multi-TB upload
directories. Backup storage costs scale with size, and slow generation means
longer maintenance windows.

While looking into reliable large backups, we discovered something wild in one
of those sites: the actual unique content was a fraction of the reported size.
They were storing the same files over and over again, each with a different
filename. The duplication was absurd.

So we shipped an optimization. Detect duplicate files by their content hash, use
hardlinks instead of downloading each copy. I wrote some new tests, they all
passed, it got approved and merged. But unfortunately, a fix like this is kind
of hard to actually fully test.

Then someone ran it on a real production backup and hit a filesystem limit I
didn't know existed. The culprit? A single reaction GIF, duplicated 246,173
times.

## The Problem

Discourse has a feature called secure uploads. When a file moves between
security contexts (say, from a private message to a public post), the system
creates a new copy with a randomized SHA1. The original content is identical,
but Discourse treats it as a new file.

This happens constantly with reaction GIFs and popular images. Users share them
across posts, embed them in PMs, repost in different categories. Each context
creates another copy.

This is mostly fine for normal operation. But for backups, it's a disaster.

One customer had 432 GB of uploads. Unique content? 26 GB. The rest was
duplicates. A 16x inflation factor, all going into the backup archive.

## The Fix

The fix seemed straightforward. Discourse tracks the original content hash in
`original_sha1`. During backup:

1. Group uploads by `original_sha1`
2. Download the first file in each group
3. Create hardlinks for the duplicates

Hardlinks point multiple filenames to the same data on disk. GNU tar preserves
them, so the archive stores the data once. Download 26 GB, archive 26 GB,
everyone wins.

```ruby
def process_upload_group(upload_group)
  primary = upload_group.first
  primary_filename = upload_path_in_archive(primary)

  return if !download_upload_to_file(primary, primary_filename)

  # Create hardlinks for all duplicates in this group
  upload_group.drop(1).each do |duplicate|
    duplicate_filename = upload_path_in_archive(duplicate)
    hardlink_or_download(primary_filename, duplicate, duplicate_filename)
  end
end
```

The `hardlink_or_download` method falls back to downloading if the hardlink
fails:

```ruby
def hardlink_or_download(source_filename, upload_data, target_filename)
  FileUtils.mkdir_p(File.dirname(target_filename))
  FileUtils.ln(source_filename, target_filename)  # Create hardlink
  increment_and_log_progress(:hardlinked)
rescue StandardError => ex
  # Fallback: download if hardlink fails
  log "Failed to create hardlink, downloading instead", ex
  download_upload_to_file(upload_data, target_filename)
end
```

Shipped it and got positive feedback.

## The Limit

A colleague then used the new version to run a backup on a large site. The logs looked great:

```
53000 files processed (25 downloaded, 52975 hardlinked). Still processing...
54000 files processed (25 downloaded, 53975 hardlinked). Still processing...
...
64000 files processed (25 downloaded, 63975 hardlinked). Still processing...
65000 files processed (25 downloaded, 64975 hardlinked). Still processing...
Failed to create hardlink for upload ID 482897, downloading instead
Failed to create hardlink for upload ID 457497, downloading instead
Failed to create hardlink for upload ID 867574, downloading instead
```

At 65,000 hardlinks, it started failing. Turns out ext4 has a limit: roughly
65,000 hardlinks per inode. One file can only have 65,000 names pointing to it.

The fallback worked and it didn't fail completely. The backup finished. But
instead of one download for all 246,173 duplicates, we got one download plus
~181,000 fallback downloads after hitting the limit.

Still better than 246,173 downloads. But not the win I expected.

## The GIF

So what file had 246,173 copies?

```ruby
Upload.where(original_sha1: '27b7a62e34...').count
=> 246173

Upload.where(original_sha1: '27b7a62e34...').first.filesize
=> 1643869
```

1.6 MB. Duplicated a quarter million times. That's 377 GB of backup bloat from
a single image.

And then I saw what it was...

![Jennifer Aniston dancing from Friends](/images/jennifer-aniston.gif)

A reaction GIF. Used constantly in posts, PMs, everywhere. Each use in a
different security context creates a new copy. 246,173 copies of Rachel from
Friends doing a happy dance.

One GIF broke the hardlink limit.

## The Math

Without deduplication: 246,173 downloads, 377 GB transferred.

With deduplication (hitting limit): ~4 downloads, ~6.4 MB transferred.

The filesystem limit turned my "download once" into "download four times." I
can live with that.

## The Fix for the Fix

My first instinct was to track hardlink counts and proactively rotate before
hitting the limit. But a colleague pointed out the flaw: we have no idea what
filesystem is being used. ext4 has one limit, XFS another, ZFS another. Picking
a magic number is fragile.

Better approach: let the filesystem tell us when we've hit the limit.

```ruby
def create_hardlink(source_filename, upload_data, target_filename)
  FileUtils.mkdir_p(File.dirname(target_filename))
  FileUtils.ln(source_filename, target_filename)
  source_filename
rescue Errno::EMLINK
  # Filesystem hardlink limit reached - copy and use as new primary
  FileUtils.cp(source_filename, target_filename)
  target_filename
rescue StandardError => ex
  download_upload_to_file(upload_data, target_filename)
  source_filename
end
```

When `Errno::EMLINK` fires, we already have the file locally. No need to
re-download. Just copy it and use the copy as the new primary for subsequent
hardlinks. Works on any filesystem, no configuration needed.

## What I Learned

Filesystems have opinions. ext4's hardlink limit exists to prevent certain
classes of bugs and attacks. It's not arbitrary.

The fallback saved the feature. Without graceful degradation, that backup would
have failed entirely. Instead it completed, just slower than optimal.

Production always finds the edge cases. 246,000 copies of one file is absurd.
But absurd things happen at scale.

A few concrete takeaways:

- Test for failure modes, not just success paths. The hardlink fallback was
  built-in from the start, but I never expected to actually need it.
- Optimizations that reduce work by 16x still need to handle edge cases. A
  99.998% improvement with graceful degradation beats a 100% improvement that
  crashes.
- Track filesystem-level constraints early. Hardlink limits, inode counts, path
  lengths - these are real operational boundaries, not theoretical concerns.

And now I know Jennifer Aniston can stress-test infrastructure.

## Links

- [Discourse PR #37261](https://github.com/discourse/discourse/pull/37261) -
  The backup deduplication fix
- [Discourse PR #37293](https://github.com/discourse/discourse/pull/37293) -
  The hardlink limit fix
