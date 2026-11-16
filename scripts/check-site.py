#!/usr/bin/env python3
"""Check the generated pages most affected by Zola template changes."""
from html.parser import HTMLParser
from pathlib import Path
import sys


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.html = path.read_text(encoding="utf-8")
        self.links = []
        self.text = []
        self.feed(self.html)

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs))

    def handle_data(self, data):
        self.text.append(data)


def require(condition, message):
    if not condition:
        raise SystemExit(f"Site check failed: {message}")


root = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
home = Page(root / "index.html")
blog = Page(root / "blog/index.html")
resume = Page(root / "resume/index.html")
projects = Page(root / "projects/index.html")
post = Page(root / "blog/2025/nixos-daily-driver-2/index.html")
code_post = Page(root / "blog/2025/building-yaks-virtual-currency-part-3/index.html")
require(home.html.count('class="post-item"') >= 3, "home page is missing posts")
require(blog.html.count('class="post-item"') >= 100, "blog index is missing posts")
require("Software Engineer | DevOps & Automation" in ''.join(resume.text), "résumé component did not render")
require("replaybook" in ''.join(projects.text), "projects component did not render")
require('class="post-series"' in post.html, "series navigation did not render")
require('class="helpful-button"' in post.html, "helpful widget did not render")
require('{{#if (eq feature.id "custom_flair")}}' in ''.join(code_post.text), "literal template example changed")
external = [link for link in post.links if link.get("href", "").startswith(("http://", "https://")) and link.get("target") == "_blank"]
require(bool(external), "external Markdown links do not open in a new tab")
require(all({"noopener", "noreferrer"}.issubset(link.get("rel", "").split()) for link in external), "external links are missing rel attributes")
internal = [link for link in post.links if link.get("href", "").startswith("/")]
require(bool(internal) and all(link.get("target") != "_blank" for link in internal), "internal links unexpectedly open in a new tab")
print("Site smoke checks passed.")
