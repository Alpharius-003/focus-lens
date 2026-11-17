import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({root:'apps/web',base:'./',publicDir:'../../public',plugins:[react()],build:{outDir:'../../dist',emptyOutDir:true},worker:{format:'es'},resolve:{alias:{'@core':resolve(import.meta.dirname,'core')}},server:{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}});
