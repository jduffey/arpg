import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';

const saveDir = path.resolve(__dirname, 'saves');

function saveApi(): Plugin {
  return {
    name: 'save-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          return next();
        }
        if (req.url === '/api/saves' && req.method === 'GET') {
          try {
            const files = await fs.readdir(saveDir);
            const jsonFiles = files.filter((file) => file.endsWith('.json'));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ saves: jsonFiles }));
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(error) }));
          }
          return;
        }
        if (req.url?.startsWith('/api/save/') && req.method === 'GET') {
          try {
            const name = decodeURIComponent(req.url.replace('/api/save/', ''));
            const filePath = path.join(saveDir, name);
            const data = await fs.readFile(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } catch (error) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: String(error) }));
          }
          return;
        }
        if (req.url === '/api/save' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body) as { name: string; data: unknown };
              await fs.mkdir(saveDir, { recursive: true });
              const filePath = path.join(saveDir, payload.name);
              await fs.writeFile(filePath, JSON.stringify(payload.data, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch (error) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: String(error) }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), saveApi()],
});
