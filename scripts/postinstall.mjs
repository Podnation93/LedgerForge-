import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

if (existsSync('node_modules/electron')) {
  spawnSync('npx', ['electron-rebuild', '-f', '-w', 'better-sqlite3'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}
