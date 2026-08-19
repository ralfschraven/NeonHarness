import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const runtimeRoot = join(repoRoot, '.desktop-runtime')
const nodeModulesRoot = join(repoRoot, 'node_modules')

async function readManifest(directory) {
  try {
    return JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

async function packageDirectories() {
  const directories = []
  for (const group of ['vendor', 'packages']) {
    const groupRoot = join(repoRoot, group)
    for (const first of await readdir(groupRoot, { withFileTypes: true })) {
      if (!first.isDirectory()) continue
      const firstPath = join(groupRoot, first.name)
      const direct = await readManifest(firstPath)
      if (direct !== null) directories.push(firstPath)
      for (const second of await readdir(firstPath, { withFileTypes: true })) {
        if (second.isDirectory() && await readManifest(join(firstPath, second.name)) !== null) {
          directories.push(join(firstPath, second.name))
        }
      }
    }
  }
  for (const app of await readdir(join(repoRoot, 'apps'), { withFileTypes: true })) {
    if (app.isDirectory() && await readManifest(join(repoRoot, 'apps', app.name)) !== null) {
      directories.push(join(repoRoot, 'apps', app.name))
    }
  }
  const nativeRoot = join(repoRoot, 'native', 'landlock-run')
  if (await readManifest(nativeRoot) !== null) directories.push(nativeRoot)
  const nativePackages = join(nativeRoot, 'packages')
  for (const entry of await readdir(nativePackages, { withFileTypes: true })) {
    if (entry.isDirectory() && await readManifest(join(nativePackages, entry.name)) !== null) {
      directories.push(join(nativePackages, entry.name))
    }
  }
  return directories
}

async function externalCandidates() {
  const result = new Map()
  async function addPackage(directory) {
    const manifest = await readManifest(directory)
    if (manifest?.name !== undefined && !result.has(manifest.name)) {
      result.set(manifest.name, { directory, manifest })
    }
  }
  async function addNodeModules(directory) {
    if (!existsSync(directory)) return
    for (const scopeOrPackage of await readdir(directory, { withFileTypes: true })) {
      if (!scopeOrPackage.isDirectory()) continue
      if (scopeOrPackage.name.startsWith('@')) {
        const scopeRoot = join(directory, scopeOrPackage.name)
        for (const packageEntry of await readdir(scopeRoot, { withFileTypes: true })) {
          if (packageEntry.isDirectory()) await addPackage(join(scopeRoot, packageEntry.name))
        }
      } else {
        await addPackage(join(directory, scopeOrPackage.name))
      }
    }
  }
  const pnpmRoot = join(nodeModulesRoot, '.pnpm')
  for (const entry of await readdir(pnpmRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const packageRoot = join(pnpmRoot, entry.name, 'node_modules')
    await addNodeModules(packageRoot)
  }
  // Profile plugins are installed outside the repository workspace. Include
  // their package closure so a packaged app preserves the user's web profile.
  await addNodeModules(join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', 'web', 'node_modules'))
  return result
}

function dependencyNames(manifest) {
  const dependencies = manifest.dependencies === undefined
    ? []
    : Object.keys(manifest.dependencies).map(name => ({ name, optional: false }))
  const optionalDependencies = manifest.optionalDependencies === undefined
    ? []
    : Object.keys(manifest.optionalDependencies).map(name => ({ name, optional: true }))
  const peerDependencies = manifest.peerDependencies === undefined
    ? []
    : Object.keys(manifest.peerDependencies).map(name => ({
      name,
      optional: manifest.peerDependenciesMeta?.[name]?.optional === true,
    }))
  return [...dependencies, ...optionalDependencies, ...peerDependencies]
    .filter(({ name }) => !name.startsWith('node:'))
    .filter(({ name }) => name.length > 0)
    .filter(({ name }, index, entries) => entries.findIndex(item => item.name === name) === index)
}

async function copySelected(source, destination) {
  await mkdir(destination, { recursive: true })
  await cp(join(source, 'package.json'), join(destination, 'package.json'))
  const directEntries = await readdir(source, { withFileTypes: true })
  for (const entry of directEntries) {
    if (entry.name === 'package.json' || entry.name === 'node_modules') continue
    if (entry.name.startsWith('README') || entry.name === 'src' || entry.name === 'tests' || entry.name === 'scripts') continue
    if (entry.isFile() && /\.(?:ts|tsx|mts|cts|map)$/.test(entry.name)) continue
    if (entry.isDirectory() && !['lib', 'dist', 'config', 'assets', 'bin', 'native', 'vendor'].includes(entry.name)) continue
    await cp(join(source, entry.name), join(destination, entry.name), { recursive: true })
  }
}

async function copyExternal(source, destination) {
  await mkdir(destination, { recursive: true })
  await cp(source, destination, {
    recursive: true,
    filter: sourcePath => !relative(source, sourcePath).split(/[\\/]/).includes('node_modules'),
  })
}

const workspace = new Map()
for (const directory of await packageDirectories()) {
  const manifest = await readManifest(directory)
  if (manifest?.name !== undefined) workspace.set(manifest.name, { directory, manifest })
}
const external = await externalCandidates()
const profileRoot = join(
  process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  'profiles',
  'web',
)
const profileManifest = await readManifest(profileRoot)
const profilePlugins = Object.keys(profileManifest?.dependencies ?? {})
const queue = [
  { name: '@deepseek-ai/dsh', optional: false },
  ...profilePlugins.map(name => ({ name, optional: false })),
]
const selected = new Map()
while (queue.length > 0) {
  const dependency = queue.shift()
  if (dependency === undefined || selected.has(dependency.name)) continue
  const name = dependency.name
  const record = workspace.get(name) ?? external.get(name)
  if (record === undefined) {
    if (dependency.optional) continue
    throw new Error(`Desktop runtime dependency is not installed: ${name}`)
  }
  selected.set(name, record)
  queue.push(...dependencyNames(record.manifest))
}

await rm(runtimeRoot, { recursive: true, force: true })
await mkdir(join(runtimeRoot, 'node_modules'), { recursive: true })
await cp(process.execPath, join(runtimeRoot, process.platform === 'win32' ? 'node.exe' : 'node'))
const cli = workspace.get('@deepseek-ai/dsh')
if (cli === undefined) throw new Error('Desktop runtime could not find the dsh CLI package')
await copySelected(cli.directory, runtimeRoot)

for (const [name, record] of selected) {
  if (name === '@deepseek-ai/dsh') continue
  const destination = join(runtimeRoot, 'node_modules', ...name.split('/'))
  if (workspace.has(name)) await copySelected(record.directory, destination)
  else await copyExternal(record.directory, destination)
}

await writeFile(join(runtimeRoot, 'runtime-manifest.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  packageCount: selected.size,
  source: relative(runtimeRoot, repoRoot),
}, null, 2) + '\n')
console.log(`Desktop runtime prepared at ${runtimeRoot} (${selected.size} packages)`)
