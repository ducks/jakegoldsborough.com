---
title: "How Jennifer Aniston and Friends Cost Us 377GB and Broke Linux Hardlinks"
date: 2026-01-23
description: "A backup deduplication fix, filesystem hardlink limits, and the Jennifer Aniston reaction GIF that stress-tested our infrastructure."
taxonomies:
  tags:
    - discourse
    - infrastructure
    - debugging
---

## Intro

It started with backup issues. Sites with hundreds of gigabytes of uploads
were running out of disk space during backup generation. One site had 600+ GB
of uploads and the backup process kept dying.

Looking into it, we discovered something wild in one of those sites: the actual
unique content was a fraction of the reported size. They were storing the same
files over and over again, each with a different filename. The duplication was
absurd.

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
  FileUtils.ln(source_filename, target_filename)
  increment_and_log_progress(:hardlinked)
rescue StandardError => ex
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

With deduplication (hitting limit): ~5 downloads (one per 60k batch), ~8 MB
transferred.

The filesystem limit turned my "download once" into "download five times." I
can live with that.

## The Fix for the Fix

For the rare case where a single file has more than 60,000 duplicates:

```ruby
MAX_HARDLINKS_PER_FILE = 60_000

def hardlink_or_download(source_filename, upload_data, target_filename)
  @hardlink_counts ||= Hash.new(0)

  if @hardlink_counts[source_filename] >= MAX_HARDLINKS_PER_FILE
    # Start a new primary to avoid filesystem limits
    download_upload_to_file(upload_data, target_filename)
    return
  end

  FileUtils.mkdir_p(File.dirname(target_filename))
  FileUtils.ln(source_filename, target_filename)
  @hardlink_counts[source_filename] += 1
rescue StandardError => ex
  download_upload_to_file(upload_data, target_filename)
end
```

Track how many hardlinks each file has. Before hitting the limit, start a new
"primary" copy. For 246k duplicates: `ceil(246173 / 60000) = 5` downloads
instead of 1. Still a 99.998% reduction.

## What I Learned

Filesystems have opinions. ext4's hardlink limit exists to prevent certain
classes of bugs and attacks. It's not arbitrary.

The fallback saved the feature. Without graceful degradation, that backup would
have failed entirely. Instead it completed, just slower than optimal.

Production always finds the edge cases. 246,000 copies of one file is absurd.
But absurd things happen at scale.

And now I know Jennifer Aniston can stress-test infrastructure.

## Links

- [Discourse PR #37261](https://github.com/discourse/discourse/pull/37261) -
  The backup deduplication fix
