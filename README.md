# jakegoldsborough.com

The site is built with Zola. The development shell pins a Nixpkgs revision
providing Zola 0.23.6, independent of your installed channel. Run:

```sh
nix-shell
zola --version
zola serve
# Or build the site:
zola build
python3 scripts/check-site.py
```

The first shell invocation may need to fetch the pinned Nixpkgs source and
packages. It requires a working Nix installation and, for a daemon-based
installation, access to the Nix daemon socket.

The shell checks the Zola version; GitHub Pages uses the same release. Zola
0.23 uses Tera 2 components for the résumé, projects, and post widgets. Blog
content skips Tera processing so literal template examples in posts remain
intact. If a future post needs a component, adjust `skip_content_templating`
and escape its literal template examples.
