import { defineConfig } from 'vite'

export default defineConfig({
    root: '.',
    base: '/lightjunction/',
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
    server: {
        port: 3000,
        open: true,
    },
})
