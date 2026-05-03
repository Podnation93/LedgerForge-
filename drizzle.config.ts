import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: './.ledgerforge-dev/ledgerforge.db',
  },
})
