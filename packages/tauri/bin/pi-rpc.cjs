#!/usr/bin/env node
// Wrapper to run pi --mode rpc from within the Tauri app.
// Resolves the pi CLI path relative to this script's location.
const path = require('path')
const fs = require('fs')

// Try to find the pi CLI from various locations
function findPiCli() {
  // 1. Check if PI_CLI env var is set
  if (process.env.PI_CLI) return process.env.PI_CLI

  // 2. Resolve from this script's location
  const scriptDir = __dirname

  // Try the server's node_modules
  const paths = [
    path.join(scriptDir, '..', '..', '..', '..', 'node_modules', '.pnpm'),
    path.join(scriptDir, '..', '..', '..', '..', 'packages', 'server', 'node_modules', '.bin', 'pi.cmd'),
  ]

  // Scan pnpm store for pi CLI
  const pnpmDir = path.join(scriptDir, '..', '..', '..', '..', 'node_modules', '.pnpm')
  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir)
    for (const entry of entries) {
      if (entry.startsWith('@earendil-works+pi-coding-agent')) {
        const cliPath = path.join(pnpmDir, entry, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'cli.js')
        if (fs.existsSync(cliPath)) return cliPath
      }
    }
  }

  // 3. Try npx
  return 'pi'
}

const cliPath = findPiCli()
const args = ['--mode', 'rpc', ...process.argv.slice(2)]

// Run the pi CLI
require(cliPath).main(args).catch(err => {
  console.error('PI RPC error:', err)
  process.exit(1)
})