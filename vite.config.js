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
});
