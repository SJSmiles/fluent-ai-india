// src/server.ts
import 'dotenv/config';
import { buildApp } from './app';  // ← relative import, not 'app'
import 'module-alias/register';
const PORT = Number(process.env.PORT) || 3001;

buildApp().then((app) => {
  app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`🚀 Server listening on port ${PORT}`);
  });
}).catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});