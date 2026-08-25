/// <reference types="vite/client" />

declare module '*.glsl?raw' {
    const source: string
    export default source
}
