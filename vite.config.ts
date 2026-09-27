import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { junctionPage, battlefieldChrome } from './scripts/junction-site.mjs'

export default defineConfig({
    root: '.',
    base: '/lightjunction/',
    plugins: [{
        name: 'junction-world',
        transformIndexHtml: {
            order: 'pre',
            handler(html, context) {
                const file = context.filename.replaceAll('\\', '/').split('/').pop()
                if (file === 'index.html' || file === 'archive.html') {
                    // archive.html is retained as the canonical source of protected
                    // challenge content and tested crypto/shader DOM, not a public UI.
                    const shell = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
                    const archive = readFileSync(new URL('./archive.html', import.meta.url), 'utf8')
                    return junctionPage(shell, archive)
                }
                if (file === 'frontier.html' || file === 'rogue.html') return battlefieldChrome(html)
                return html
            },
        },
    }],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rolldownOptions: {
            input: {
                world: 'index.html',
                archive: 'archive.html',
                frontier: 'frontier.html',
                rogue: 'rogue.html',
            },
        },
    },
    server: { port: 3000, open: true },
})
