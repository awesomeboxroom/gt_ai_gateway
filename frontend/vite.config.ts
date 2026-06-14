import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

function dataViewerDistOnlyPlugin() {
    return {
        name: 'data-viewer-dist-only',
        closeBundle() {
            const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
            const outputDataViewerDir = resolve(frontendRoot, 'dist/data_viewer')
            const sourceDataViewerDist = resolve(frontendRoot, 'public/data_viewer/dist')
            const outputDataViewerDist = resolve(outputDataViewerDir, 'dist')

            rmSync(outputDataViewerDir, { recursive: true, force: true })

            if (existsSync(sourceDataViewerDist)) {
                cpSync(sourceDataViewerDist, outputDataViewerDist, { recursive: true })
            }
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        Components({
            resolvers: [
                AntDesignVueResolver({
                    importStyle: false, // Ant Design Vue 4.x uses CSS-in-JS
                }),
            ],
        }),
        dataViewerDistOnlyPlugin(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 5173,
        strictPort: true, // 如果 5173 被占用，直接报错退出，不再尝试下一个端口
        host: '127.0.0.1',
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://localhost:8787',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: fileURLToPath(new URL('./index.html', import.meta.url)),
                splash: fileURLToPath(new URL('./splash.html', import.meta.url)),
            },
        },
    },
})
