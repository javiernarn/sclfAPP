import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

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
    ],
    build: {
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
