import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_API_URL || 'http://localhost:8081/api';
  
  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['@radix-ui/react-tooltip', '@radix-ui/react-popover']
    },
    server: {
      port: parseInt(env.VITE_PORT || '5174'),
      host: env.VITE_HOST || '0.0.0.0',
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: backendUrl.replace('/api', ''),
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
