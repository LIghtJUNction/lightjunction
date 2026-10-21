import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// One public website. Legacy game/archive sources remain in Git, not in dist.
export default defineConfig({
    root: '.',
    base: '/lightjunction/',
    publicDir: false,
    plugins: [{
        name: 'public-downloads',
        generateBundle() {
            // Keep public keys and the original challenge available verbatim.
            for (const [fileName, sourcePath] of [
                ['pubkey.asc', './pubkey.asc'],
                ['age-recipients.txt', './public/age-recipients.txt'],
                ['junction-ii.png', './public/junction-ii.png'],
            ]) {
                this.emitFile({
                    type: 'asset', fileName,
                    source: readFileSync(new URL(sourcePath, import.meta.url)),
                })
            }
        },
    }],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rolldownOptions: { input: 'index.html' },
    },
    server: { port: 3000, open: true },
})
