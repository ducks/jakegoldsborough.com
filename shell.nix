{ pkgs ? import (builtins.fetchTarball {
    # Pinned Nixpkgs revision provides the same Zola release as GitHub Pages.
    url = "https://github.com/NixOS/nixpkgs/archive/d5cc6833999746cffdfe0598f7bc801a57b887a9.tar.gz";
    sha256 = "sha256-Wpz/7x/YWnDIBu7yj6ixe8j6fIMsidd9Y+o1PqPF3iM=";
  }) {} }:

assert pkgs.lib.assertMsg (pkgs.zola.version == "0.23.6")
  "This site uses Zola 0.23.6, matching GitHub Pages.";

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
