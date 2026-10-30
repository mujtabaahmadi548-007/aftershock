// Bundles the app into one self-contained HTML page.
//   dist/index.html   - page content for publishing (the host adds the document skeleton)
//   dist/preview.html - full HTML document for local/headless testing
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
mkdirSync(root + 'dist', { recursive: true });
const res = await build({
  entryPoints: [root + 'src/ui/main.js'],
  bundle: true, minify: true, format: 'iife', target: ['es2020'], write: false,
  loader: { '.json': 'json' }, legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(root + 'src/ui/styles.css', 'utf8');
const shell = readFileSync(root + 'src/ui/shell.html', 'utf8');
const head = `<title>AFTERSHOCK</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Deterministic causal simulation of hypothetical global shocks, with every assumption labelled.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${css}</style>`;
const page = `${head}\n${shell}\n<script>${js}</script>\n`;
writeFileSync(root + 'dist/index.html', page);
// Standalone document: open directly in a browser or serve with GitHub Pages (repo root index.html).
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#090d14">
${head}
</head>
<body>
${shell}
<script>${js}</script>
</body>
</html>
`;
writeFileSync(root + 'dist/preview.html', standalone);
writeFileSync(root + 'index.html', standalone);
console.log(`dist/index.html ${(page.length / 1024).toFixed(0)} KB (js ${(js.length / 1024).toFixed(0)} KB)`);
