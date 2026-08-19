import { app, BrowserWindow, dialog } from 'electron'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const APP_URL_HOST = '127.0.0.1'
const BACKEND_START_TIMEOUT_MS = 60_000
const UPDATE_CHECK_DELAY_MS = 10_000
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000

let backend = null
let mainWindow = null
let quitting = false

/** Reserve an unused loopback port for the embedded Web backend. */
async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, APP_URL_HOST, () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Could not determine a free local port')))
        return
      }
      server.close(error => error === undefined ? resolvePort(address.port) : reject(error))
    })
  })
}

/** Resolve the copied backend runtime in development and packaged builds. */
function runtimeRoot() {
  return app.isPackaged
    ? join(process.resourcesPath, 'runtime')
    : fileURLToPath(new URL('../../.desktop-runtime/', import.meta.url))
}

/** Resolve bundled app assets in both source and packaged layouts. */
function appAssetsRoot() {
  return app.isPackaged
    ? app.getAppPath()
    : fileURLToPath(new URL('.', import.meta.url))
}

/** Stop the embedded backend and its child process tree. */
async function stopBackend() {
  const child = backend
  backend = null
  if (child === null || child.exitCode !== null) return
  if (process.platform === 'win32') {
    await new Promise(resolveKill => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
      killer.once('close', () => resolveKill())
      killer.once('error', () => resolveKill())
    })
    return
  }
  child.kill('SIGTERM')
}

/** Wait until the embedded Web server is serving its frontend. */
async function waitForBackend(port, output) {
  const deadline = Date.now() + BACKEND_START_TIMEOUT_MS
  const url = `http://${APP_URL_HOST}:${String(port)}/`
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status === 404) return url
    } catch {
      // The server is still starting or has not bound its port yet.
    }
    if (backend?.exitCode !== null) break
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250))
  }
  const detail = output.join('').trim()
  throw new Error(detail === ''
    ? `The embedded harness did not start at ${url}`
    : `The embedded harness failed to start:\n${detail}`)
}

/** Start the existing dsh Web profile inside Electron's bundled Node runtime. */
async function startBackend() {
  const root = runtimeRoot()
  const entry = join(root, 'lib', 'bin.js')
  if (!existsSync(entry)) throw new Error(`Embedded runtime is missing ${entry}`)
  const nodeExecutable = join(root, process.platform === 'win32' ? 'node.exe' : 'node')
  if (!existsSync(nodeExecutable)) throw new Error(`Embedded Node runtime is missing ${nodeExecutable}`)
  const port = await freePort()
  const output = []
  const child = spawn(nodeExecutable, [entry, '--profile', 'web', '--port', String(port)], {
    cwd: root,
    env: {
      ...process.env,
      DSH_DESKTOP: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  backend = child
  child.stdout?.on('data', chunk => output.push(String(chunk)))
  child.stderr?.on('data', chunk => output.push(String(chunk)))
  child.once('error', error => output.push(`${error.message}\n`))
  return await waitForBackend(port, output)
}

/** Configure updates when the packaged build has a generated update feed. */
async function setupAutoUpdater() {
  if (!app.isPackaged) return
  const updateConfig = join(process.resourcesPath, 'app-update.yml')
  const updateUrl = process.env.DSH_UPDATE_URL
  if (!existsSync(updateConfig) && updateUrl === undefined) return
  const { autoUpdater } = await import('electron-updater')
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  if (updateUrl !== undefined && updateUrl !== '') {
    autoUpdater.setFeedURL({ provider: 'generic', url: updateUrl })
  }
  autoUpdater.on('error', error => console.warn(`Desktop update check failed: ${error.message}`))
  autoUpdater.on('update-downloaded', async () => {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'NeonHarness update ready',
      message: 'A new version has been downloaded.',
      detail: 'Restart the app to install it.',
    })
    if (choice.response === 0) autoUpdater.quitAndInstall()
  })
  const check = () => { void autoUpdater.checkForUpdates().catch(() => {}) }
  setTimeout(check, UPDATE_CHECK_DELAY_MS)
  setInterval(check, UPDATE_CHECK_INTERVAL_MS)
}

/** Create the desktop window after the embedded backend is ready. */
async function createMainWindow() {
  const url = await startBackend()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#141416',
    icon: join(appAssetsRoot(), 'assets', 'deepseek-harness-icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.on('closed', () => { mainWindow = null })
  await mainWindow.loadURL(url)
  await setupAutoUpdater()
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === null) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.on('ready', () => {
    return createMainWindow().catch(async error => {
      console.error('[dsh-desktop] startup failed', error instanceof Error ? error.stack : JSON.stringify(error))
      await dialog.showMessageBox({
        type: 'error',
        title: 'NeonHarness could not start',
        message: error instanceof Error ? error.message : String(error),
      })
      app.quit()
    })
  })
  app.on('before-quit', event => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    void stopBackend().finally(() => app.quit())
  })
  app.on('activate', () => {
    if (mainWindow === null) void createMainWindow()
  })
}
