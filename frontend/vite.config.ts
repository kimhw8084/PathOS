import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rootDir = path.resolve(process.cwd(), '..');
  const configDir = process.env.PATHOS_CONFIG_DIR || path.join(rootDir, 'config');
  const selectedProfile = (process.env.PATHOS_PROFILE || '').trim();
  const basePath = path.join(configDir, 'base.json');
  const profilePath = selectedProfile ? path.join(configDir, 'profiles', `${selectedProfile}.json`) : '';

  const merge = (base: any, overlay: any): any => {
    if (!overlay || typeof overlay !== 'object') return base;
    const merged = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && typeof merged[key] === 'object' && !Array.isArray(merged[key])) {
        merged[key] = merge(merged[key], value);
      } else {
        merged[key] = value;
      }
    }
    return merged;
  };

  const readJson = (filePath: string) => {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  };

  const resolvedProfile = merge(readJson(basePath), profilePath ? readJson(profilePath) : {});
  const backendUrl = env.VITE_API_URL || resolvedProfile?.network?.frontend?.api_url || 'http://localhost:8085/api';
  const frontendPort = env.VITE_PORT || String(resolvedProfile?.network?.frontend?.port || '5174');
  const frontendHost = env.VITE_HOST || resolvedProfile?.network?.frontend?.host || '0.0.0.0';
  const apiBasePath = env.VITE_API_BASE_PATH || resolvedProfile?.network?.backend?.api_prefix || '/api';
  
  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['@radix-ui/react-tooltip', '@radix-ui/react-popover', 'reactflow']
    },
    server: {
      port: parseInt(frontendPort),
      host: frontendHost,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        [apiBasePath]: {
          target: backendUrl.replace('/api', ''),
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
