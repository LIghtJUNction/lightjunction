import { defineConfig } from 'vite'
import { frontierArchive } from './scripts/frontier-archive.mjs'

export default defineConfig({
    root: '.',
    base: '/lightjunction/',
    plugins: [{
        name: 'frontier-site-shell',
        transformIndexHtml: {
            order: 'pre',
            handler(html, context) {
                if (!context.filename.replaceAll('\\', '/').endsWith('/archive.html')) return html
                return {
                    html: frontierArchive(html),
                    tags: [{ tag: 'script', attrs: { type: 'module', src: '/src/frontier-archive.mjs' }, injectTo: 'body' }],
                }
            },
        },
    }],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rolldownOptions: {
            input: {
                game: 'index.html',
                rogue: 'rogue.html',
                archive: 'archive.html',
            },
        },
    },
    server: { port: 3000, open: true },
})
