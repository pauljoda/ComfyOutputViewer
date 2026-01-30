{
  description = "Comfy Output Viewer - local-first image browser for ComfyUI outputs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    let
      supportedSystems = flake-utils.lib.defaultSystems;
    in
    flake-utils.lib.eachSystem supportedSystems (system:
      let
        pkgs = import nixpkgs { inherit system; };
        lib = pkgs.lib;
        nodejs = pkgs.nodejs_22;
        pkgJson = builtins.fromJSON (builtins.readFile ./package.json);
        comfy-output-viewer = pkgs.buildNpmPackage {
          pname = pkgJson.name;
          version = pkgJson.version;
          nodejs = nodejs;
          src = lib.cleanSourceWith {
            src = ./.;
            filter = path: type:
              let
                base = lib.baseNameOf path;
              in
              !(base == "node_modules" || base == "dist" || base == ".cache" || base == ".git");
          };
          npmDepsHash = "sha256-N+/M76QpTdjjC+wMnAMUTBKjHGr3JMFZMqxk4OLs0L0=";
          npmBuildScript = "build";
          # Required for building sharp from source
          nativeBuildInputs = with pkgs; [ makeWrapper pkg-config python3 ];
          buildInputs = with pkgs; [
            vips       # Image processing library for sharp
            glib       # Required by vips
          ];
          # Ensure sharp rebuilds with system vips instead of using prebuilt binaries
          preBuild = ''
            export npm_config_build_from_source=true
          '';
          installPhase = ''
            runHook preInstall
            appDir=$out/lib/comfy-output-viewer
            mkdir -p "$appDir"
            cp -r dist server package.json node_modules "$appDir/"
            makeWrapper ${nodejs}/bin/node $out/bin/comfy-output-viewer \
              --add-flags "$appDir/server/index.js" \
              --set NODE_PATH "$appDir/node_modules" \
              --chdir "$appDir"
            runHook postInstall
          '';
          meta = with lib; {
            description = "Local-first image browser for ComfyUI outputs";
            mainProgram = "comfy-output-viewer";
            platforms = platforms.all;
          };
        };
      in
      {
        packages.default = comfy-output-viewer;
        packages.comfy-output-viewer = comfy-output-viewer;
        apps.default = flake-utils.lib.mkApp { drv = comfy-output-viewer; };
      }
    )
    // {
      overlays.default = final: prev: {
        comfy-output-viewer = self.packages.${final.system}.default;
      };
      nixosModules.default = import ./nix/module.nix;
      nixosModules.comfy-output-viewer = import ./nix/module.nix;
    };
}
