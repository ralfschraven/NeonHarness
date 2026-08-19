# DeepSeek Harness desktop app

This package wraps the existing `dsh --profile web` server in Electron. The
server is copied into `.desktop-runtime` before packaging, so the installed
app does not need a separate Node.js installation or a running localhost
terminal.

## Local development

From the repository root:

```powershell
pnpm run desktop:dev
```

## Build a Windows installer

```powershell
pnpm run desktop:build
```

The installer is written to `release/desktop`. Local builds deliberately do
not configure an update feed.

## Publish updates

The `Desktop release` GitHub Actions workflow builds x64 and arm64 NSIS
installers when a `desktop-v*` tag is pushed. It publishes the installer and
`latest.yml` to a GitHub Release. The packaged app checks that feed after
startup, downloads updates in the background, and offers to restart when the
update is ready.

Before each release, increment the version in this package's
`package.json`, commit it, and push a tag such as `desktop-v0.1.1`.

## Local self-signing

For a local Windows build, electron-builder can use a code-signing certificate
from the current user's certificate store. Set
`DSH_SIGNING_THUMBPRINT` to the certificate thumbprint before running
`pnpm run desktop:build`. Do not commit private keys or certificate passwords.

Self-signed certificates are intended for personal testing or managed PCs. A
different computer will not automatically trust the certificate, and Windows
SmartScreen may still display a warning.
