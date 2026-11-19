import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// Publish the profile, its downloads, and the preserved static challenge.
export default defineConfig({
    root: '.',
    base: '/lightjunction/',
    publicDir: false,
    plugins: [{
        name: 'public-downloads',
        generateBundle() {
            // Keep the protected source section verbatim. Only resolve its image
            // against archive.html's deployment directory in the generated copy.
            const archive = readFileSync(new URL('./archive.html', import.meta.url), 'utf8')
                .replace('src="/junction-ii.png"', 'src="./junction-ii.png"')
            this.emitFile({ type: 'asset', fileName: 'archive.html', source: archive })
            // Keep public keys and the original challenge available verbatim.
            for (const [fileName, sourcePath] of [
                ['pubkey.asc', './pubkey.asc'],
                ['age-recipients.txt', './public/age-recipients.txt'],
                ['junction-ii.png', './public/junction-ii.png'],
                ['fonts/LICENSE-Manrope.txt', './public/fonts/LICENSE-Manrope.txt'],
                ['fonts/LICENSE-IBM-Plex-Mono.txt', './public/fonts/LICENSE-IBM-Plex-Mono.txt'],
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
    server: { host: '127.0.0.1', port: 3000, open: true },
})
