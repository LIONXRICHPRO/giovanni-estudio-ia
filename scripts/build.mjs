import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm('docs', { recursive: true, force: true });
await mkdir('docs', { recursive: true });
await cp('src', 'docs', { recursive: true });
await writeFile('docs/.nojekyll', '');
console.log('Aplicación lista en docs/ para GitHub Pages.');
