import { defineConfig } from 'vite'

export default defineConfig({
    root: '.',
    base: '/lightjunction/',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: 'index.html',
                simple: 'simple.html',
            },
        },
    },
    server: {
        port: 3000,
        open: true,
    },
})
