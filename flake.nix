# Copyright 2026 maeshinshin
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

{
  description = "A flake for a Go development environment using devshell.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    devshell.url = "github:numtide/devshell";
    flake-utils.url = "github:numtide/flake-utils";
    go-overlay.url = "github:purpleclay/go-overlay";
  };

  outputs =
    { self
    , nixpkgs
    , flake-utils
    , devshell
    , go-overlay
    ,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;

          overlays = [
            devshell.overlays.default
            go-overlay.overlays.default
          ];
          config.allowUnfree = true;
        };
      in
      {
        devShell = pkgs.devshell.mkShell {
          commands = [
            {
              package = pkgs.go-bin.versions."1.26.2";
            }
            {
              package = pkgs.golangci-lint;
            }
            {
              package = pkgs.buf;
            }
            {
              package = pkgs.pnpm;
            }
          ];
        };
      }
    );
}
