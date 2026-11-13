import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Source maps turn a minified crash location (main-C7U8P8xH.js:1:48213) back
// into the real file and line. They contain the original source code, so they
// must NEVER be served to visitors:
//   - build.sourcemap is 'hidden': the .map files are written, but the bundles
//     carry no "//# sourceMappingURL" comment, so no browser or DevTools asks
//     for them;
//   - this plugin then MOVES every .map out of public/ into
//     storage/app/private/sourcemaps/, which the web server cannot reach;
//   - `php artisan client-errors:decode` reads them from there.
// Set SCLF_SOURCEMAPS=false to build without maps at all.
const SOURCEMAPS_ENABLED = process.env.SCLF_SOURCEMAPS !== 'false';
const SOURCEMAP_KEEP_DAYS = 30; // old bundles stay in users' caches for a while

function privateSourceMaps() {
    let outDir = '';
    let root = '';

    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : [full];
    });

    return {
        name: 'sclf-private-source-maps',
        apply: 'build',
        enforce: 'post',
        configResolved(config) {
            root = config.root;
            outDir = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
            if (!SOURCEMAPS_ENABLED || !fs.existsSync(outDir)) return;

            const target = path.resolve(root, 'storage/app/private/sourcemaps');
            fs.mkdirSync(target, { recursive: true });

            let moved = 0;
            for (const file of walk(outDir).filter((f) => f.endsWith('.map'))) {
                const dest = path.join(target, path.basename(file));
                try {
                    fs.renameSync(file, dest);
                } catch {
                    // rename fails across drives/volumes: copy, then remove the public one
                    fs.copyFileSync(file, dest);
                    fs.unlinkSync(file);
                }
                moved += 1;
            }

            // File names carry a content hash, so maps of older builds never clash with
            // new ones. Drop the ones nobody can still be running.
            const cutoff = Date.now() - SOURCEMAP_KEEP_DAYS * 86_400_000;
            for (const f of fs.readdirSync(target)) {
                const full = path.join(target, f);
                if (f.endsWith('.map') && fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
            }

            // eslint-disable-next-line no-console
            console.log(`[sclf] ${moved} source map(s) moved to storage/app/private/sourcemaps (not public)`);
        },
    };
}

// lucide-animated ships one big file in which every icon is a top-level
// `var XIcon = forwardRef(...)` call, and its package.json does not say it is
// free of side effects. Rollup therefore cannot prove an unused icon is safe to
// drop and keeps ALL of them (~540 kB minified) although the app uses about 55.
// Marking those calls /*#__PURE__*/ lets unused icons be removed. Build-only
// and harmless: forwardRef() only wraps a component, it does nothing else.
function lucideAnimatedPure() {
    const isTarget = /node_modules[\\/]lucide-animated[\\/]dist[\\/]index\.js/;
    const topLevelForwardRef = /^(var [A-Za-z0-9_]+ = )(forwardRef\d*\()/gm;
    // `XIcon.displayName = "XIcon";` also counts as a side effect to Rollup, so
    // it would keep the icon alive. It only sets a label for React DevTools.
    const displayNameLine = /^[A-Za-z0-9_]+\.displayName = ".*";$/gm;

    return {
        name: 'sclf-lucide-animated-pure',
        enforce: 'pre',
        apply: 'build',
        transform(code, id) {
            if (!isTarget.test(id)) return null;
            const out = code
                .replace(topLevelForwardRef, '$1/*#__PURE__*/ $2')
                .replace(displayNameLine, '');
            return out === code ? null : { code: out, map: null };
        },
    };
}

export default defineConfig({
    plugins: [
        lucideAnimatedPure(),
        laravel({
            input: 'resources/js/main.jsx',
            refresh: true,
        }),
        react(),
        privateSourceMaps(),
    ],
    build: {
        sourcemap: SOURCEMAPS_ENABLED ? 'hidden' : false,
        // The face-detection library (~1.3 MB, loaded only when someone opens the
        // profile-photo pop-up) is deliberately its own lazy file; everything else
        // stays well under 500 kB, so a limit just above it keeps the warning
        // meaningful for the rest of the app.
        chunkSizeWarningLimit: 1400,
        rollupOptions: {
            output: {
                // Split the big, rarely-changing libraries out of the main file into
                // their own long-cached files. After a deploy, visitors re-download
                // only the small app chunk instead of React/animation code again, the
                // files load in parallel, and no single file passes Vite's 500 kB
                // warning. Pages are already lazy-loaded (see routes/index.js), and
                // page-only libraries (qr-scanner, qrcode) are deliberately NOT listed
                // so they keep loading only on the pages that use them.
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (/node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return 'vendor-react';
                    if (/node_modules[\\/](motion|motion-dom|motion-utils|framer-motion|lucide-animated)[\\/]/.test(id)) return 'vendor-motion';
                    if (/node_modules[\\/]axios[\\/]/.test(id)) return 'vendor-http';
                    if (/node_modules[\\/](crypto-js|react-secure-storage)[\\/]/.test(id)) return 'vendor-crypto';
                    return undefined;
                },
            },
        },
    },
});
