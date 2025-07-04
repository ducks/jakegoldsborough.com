{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "zola-blog-dev-shell";

  buildInputs = [
    pkgs.rustc
    pkgs.cargo
    pkgs.zola
  ];

  shellHook = ''
    echo "Zola blog dev shell ready."
    echo "Use 'zola serve' to start the server."
  '';
}
