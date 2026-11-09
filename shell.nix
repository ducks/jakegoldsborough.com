{ pkgs ? import <nixpkgs> {} }:

assert pkgs.lib.assertMsg (pkgs.lib.versionAtLeast pkgs.zola.version "0.19" && pkgs.lib.versionOlder pkgs.zola.version "0.21")
  "This site requires Zola 0.19.x or 0.20.x; GitHub Pages uses 0.20.0.";

pkgs.mkShell {
  name = "zola-blog-dev-shell";

  buildInputs = [
    pkgs.rustc
    pkgs.cargo
    pkgs.zola
  ];

  shellHook = ''
    echo "Zola blog dev shell ready: $(zola --version)"
    echo "Use 'zola serve' to start the server."
  '';
}
