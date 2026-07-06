// Build pi standalone binary
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function findPiCli() {
  const pnpmDir = resolve(__dirname, '..', '..', '..', 'node_modules', '.pnpm')
  if (existsSync(pnpmDir)) {
    const entries = readdirSync(pnpmDir)
    for (const entry of entries) {
      if (entry.startsWith('@earendil-works+pi-coding-agent@')) {
        const candidate = resolve(pnpmDir, entry, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'cli.js')
        if (existsSync(candidate)) return candidate
      }
    }
  }
  throw new Error('pi CLI not found in pnpm store')
}

const cliPath = findPiCli()
const outFile = resolve(__dirname, 'pi')

console.log(`PI CLI: ${cliPath}`)
console.log(`Output: ${outFile}.exe`)

execSync(
  `bun build --compile --outfile="${outFile}" --target=bun-windows-x64 --env=disable "${cliPath}"`,
  { stdio: 'inherit', cwd: __dirname }
)