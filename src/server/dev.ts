import { createApp } from './app';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function startDevServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr: any) {
      console.warn('[VITE DEV SERVER NOTICE]', viteErr?.message || viteErr);
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        const express = (await import('express')).default;
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('--------------------------------------------------');
    console.log(`🚀 MTS LAB SERVER RUNNING ON PORT ${PORT}`);
    console.log(`💻 LOCAL: http://localhost:${PORT}`);
    console.log('⚡ BACKEND: Supabase PostgreSQL + Supabase Auth');
    console.log('--------------------------------------------------');
  });
}

startDevServer().catch(console.error);
