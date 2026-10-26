import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwindcssPostcss from '@tailwindcss/postcss';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function buildErpAssets() {
  const start = Date.now();
  await fs.mkdir(path.join(ROOT, 'public'), { recursive: true });

  // 1. Bundle React ERP application with esbuild
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'ClientEntry.tsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    outfile: path.join(ROOT, 'public', 'erp-app.js'),
    logLevel: 'warning',
  });

  // 2. Compile src/index.css with Tailwind CSS v4 PostCSS plugin
  const cssInputPath = path.join(ROOT, 'src', 'index.css');
  const cssOutputPath = path.join(ROOT, 'public', 'erp-app.css');
  const rawCss = await fs.readFile(cssInputPath, 'utf8');
  const processed = await postcss([tailwindcssPostcss()]).process(rawCss, {
    from: cssInputPath,
    to: cssOutputPath,
  });
  await fs.writeFile(cssOutputPath, processed.css, 'utf8');

  console.log(`Built public/erp-app.js and public/erp-app.css in ${Date.now() - start}ms`);
}

buildErpAssets().catch((err) => {
  console.error('Failed to build ERP assets:', err);
  process.exit(1);
});
