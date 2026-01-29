{ config, lib, pkgs, ... }:
let
  cfg = config.services.comfy-output-viewer;
  # Check if using the default dataDir (managed by StateDirectory)
  useStateDirectory = cfg.dataDir == "/var/lib/comfy-output-viewer";
in
{
  options.services.comfy-output-viewer = {
    enable = lib.mkEnableOption "Comfy Output Viewer web UI and API server";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.comfy-output-viewer;
      defaultText = "pkgs.comfy-output-viewer";
      description = "Package providing the Comfy Output Viewer server.";
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "comfy-output-viewer";
      description = "User account under which the service runs.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "comfy-output-viewer";
      description = "Group under which the service runs.";
    };

    createUser = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = "Whether to create the service user/group.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 8008;
      description = "Port to expose the HTTP server.";
    };

    outputDir = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/comfyui/output";
      description = "Source directory that ComfyUI writes to.";
    };

    dataDir = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/comfy-output-viewer";
      description = "Writable data directory for mirrored images and metadata.";
    };

    syncIntervalMs = lib.mkOption {
      type = lib.types.nullOr lib.types.int;
      default = null;
      description = "Optional sync interval in milliseconds (null disables).";
    };

    thumbMax = lib.mkOption {
      type = lib.types.int;
      default = 512;
      description = "Maximum thumbnail dimension.";
    };

    thumbQuality = lib.mkOption {
      type = lib.types.int;
      default = 72;
      description = "JPEG quality for thumbnails.";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether to open the configured port in the firewall.";
    };

    extraEnvironment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = {};
      description = "Extra environment variables to add to the service.";
    };
  };

  config = lib.mkIf cfg.enable {
    users.groups = lib.mkIf cfg.createUser {
      ${cfg.group} = {};
    };

    users.users = lib.mkIf cfg.createUser {
      ${cfg.user} = {
        isSystemUser = true;
        group = cfg.group;
      };
    };

    # Only use tmpfiles for custom dataDir paths; StateDirectory handles the default
    systemd.tmpfiles.rules = lib.mkIf (!useStateDirectory) [
      "d ${cfg.dataDir} 0750 ${cfg.user} ${cfg.group} - -"
      "d ${cfg.dataDir}/.thumbs 0750 ${cfg.user} ${cfg.group} - -"
    ];

    systemd.services.comfy-output-viewer = {
      description = "Comfy Output Viewer";
      after = [ "network.target" "local-fs.target" ];
      wantedBy = [ "multi-user.target" ];
      environment =
        {
          NODE_ENV = "production";
          SERVER_PORT = toString cfg.port;
          COMFY_OUTPUT_DIR = cfg.outputDir;
          DATA_DIR = cfg.dataDir;
          THUMB_MAX = toString cfg.thumbMax;
          THUMB_QUALITY = toString cfg.thumbQuality;
        }
        // lib.optionalAttrs (cfg.syncIntervalMs != null) {
          SYNC_INTERVAL_MS = toString cfg.syncIntervalMs;
        }
        // cfg.extraEnvironment;
      serviceConfig = {
        ExecStart = "${cfg.package}/bin/comfy-output-viewer";
        Restart = "on-failure";
        RestartSec = "5s";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.dataDir;

        # Security hardening
        NoNewPrivileges = true;
        ProtectSystem = "strict";
        # Use read-only instead of true to allow reading outputDir from /home paths
        ProtectHome = "read-only";
        PrivateTmp = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        PrivateDevices = true;

        # Allow read-write access to data directory
        # Note: outputDir is read via normal filesystem access; the app gracefully
        # handles the case where outputDir doesn't exist yet
        ReadWritePaths = [ cfg.dataDir ];
      } // lib.optionalAttrs useStateDirectory {
        # Use StateDirectory for the default path
        StateDirectory = "comfy-output-viewer";
        StateDirectoryMode = "0750";
      };
    };

    networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];
  };
}
