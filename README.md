# jakegoldsborough.com

The site is built with Zola. For local development, use a nixpkgs channel that
provides Zola 0.19.x or 0.20.x, then run:

```sh
nix-shell
zola --version
zola serve
# Or build the site:
zola build
```

The Nix shell checks the Zola version because a system-wide `zola` may be newer
than the version this site supports. The GitHub Pages workflow uses Zola 0.20.0. The shell also accepts 0.19.x, which
is available in the current local nixpkgs channel; use 0.20.0 to match GitHub
Pages exactly. Zola 0.23 upgrades Tera and removes the shortcode system
used by this site, so upgrading to it requires a template and content migration;
updating the version number alone is not enough.
