import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { handleAiRequest } from './server/openaiResponse';

const aiDevPlugin = (env: Record<string, string>) => ({
  name: 'ai-dev-plugin',
  configureServer(server: any) {
    server.middlewares.use('/api/ai/respond', (req: any, res: any, next: any) => {
      if (req.method !== 'POST') {
        next();
        return;
      }

      let rawBody = '';

      req.on('data', (chunk: Buffer) => {
        rawBody += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const body = rawBody ? JSON.parse(rawBody) : {};
          const result = await handleAiRequest(body, {
            ...env,
            ...process.env,
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (error: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message || 'Falha ao processar a IA.' }));
        }
      });
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss(), aiDevPlugin(env)],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'process.env.VITE_SUPABASE_URL': JSON.stringify(
        process.env.VITE_SUPABASE_URL ||
          env.VITE_SUPABASE_URL ||
          env.NEXT_PUBLIC_SUPABASE_URL ||
          'https://mwbqjvmmgnopgpgplgzi.supabase.co'
      ),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        process.env.VITE_SUPABASE_ANON_KEY ||
          env.VITE_SUPABASE_ANON_KEY ||
          env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          'sb_publishable_DmSGbHAWLDQeUjvmVodluw_9ClLqdfz'
      ),
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_URL || 'https://mwbqjvmmgnopgpgplgzi.supabase.co'
      ),
      'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_DmSGbHAWLDQeUjvmVodluw_9ClLqdfz'
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('motion')) return 'vendor-motion';
            if (id.includes('date-fns')) return 'vendor-date';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
