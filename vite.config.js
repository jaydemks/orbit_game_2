import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const musicCatalog = {
  name: 'orbit-music-catalog',
  resolveId(id) { if (id === 'virtual:orbit-music') return '\0orbit-music'; },
  load(id) {
    if (id !== '\0orbit-music') return;
    const files = Array.from({length:10}, (_, i) => `Track_${String(i+1).padStart(2,'0')}.mp3`)
      .filter(name => existsSync(resolve('public/music', name)));
    return `export default ${JSON.stringify(files)}.map(name => import.meta.env.BASE_URL + 'music/' + name);`;
  },
};
export default defineConfig({ base: './', plugins: [musicCatalog], server: { host: '127.0.0.1', port: 5173 }, build: { chunkSizeWarningLimit: 800 } });
