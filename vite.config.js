import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const srcPath = path.resolve(projectRoot, 'src')

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': srcPath
		}
	},
	css: {
		preprocessorOptions: {
			scss: {
				loadPaths: [srcPath]
			}
		}
	},
	server: {
		host: '0.0.0.0',
		port: 5173
	}
})
