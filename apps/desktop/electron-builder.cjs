const path = require('node:path')

const updateOwner = process.env.DSH_UPDATE_OWNER
const updateRepo = process.env.DSH_UPDATE_REPO
const signingThumbprint = process.env.DSH_SIGNING_THUMBPRINT
const signingConfigured = Boolean(
  signingThumbprint || process.env.WIN_CSC_LINK || process.env.CSC_LINK,
)

/**
 * Windows installer configuration. A GitHub publisher is emitted only when
 * both values are supplied, so local builds never point an installed app at a
 * guessed repository. Set DSH_UPDATE_OWNER and DSH_UPDATE_REPO in the release
 * workflow to enable electron-updater for published builds.
 */
module.exports = {
  appId: 'ai.deepseek.harness',
  productName: 'NeonHarness',
  artifactName: 'NeonHarness-Setup-${version}.${ext}',
  directories: {
    output: path.resolve(__dirname, '../../release/desktop'),
  },
  files: [
    'main.mjs',
    'package.json',
    'assets/**/*',
  ],
  extraResources: [
    {
      from: path.resolve(__dirname, '../../.desktop-runtime'),
      to: 'runtime',
      filter: ['**/*', '!node_modules/**/*'],
    },
    {
      from: path.resolve(__dirname, '../../.desktop-runtime/node_modules'),
      to: 'runtime/node_modules',
      filter: ['**/*'],
    },
  ],
  asar: true,
  forceCodeSigning: signingConfigured,
  win: {
    compression: 'store',
    target: [{ target: 'nsis', arch: ['x64', 'arm64'] }],
    icon: path.resolve(__dirname, 'assets/neon-harness-icon.ico'),
    ...(signingThumbprint
      ? { signtoolOptions: { certificateSha1: signingThumbprint } }
      : {}),
  },
  nsis: {
    differentialPackage: false,
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NeonHarness',
  },
  publish: updateOwner && updateRepo
    ? [{ provider: 'github', owner: updateOwner, repo: updateRepo }]
    : undefined,
}
