{ pkgs ? import <nixpkgs> {}}:

pkgs.mkShell {
    packages = [
        pkgs.hello
        pkgs.nodejs_20
    ];
}
