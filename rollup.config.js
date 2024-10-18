import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser'; // Mudança aqui
import { babel } from '@rollup/plugin-babel';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import sveltePreprocess from 'svelte-preprocess';
import postcss from 'rollup-plugin-postcss'; // Adicione esta linha

const production = !process.env.ROLLUP_WATCH;

export default {
    input: 'src/main.js',
    output: {
        sourcemap: true,
        format: 'iife',
        name: 'app',
        file: 'public/build/bundle.js',
    },
    plugins: [
        svelte({
            preprocess: sveltePreprocess(),
            compilerOptions: {
                dev: !production,
            },
            emitCss: true,
        }),
        postcss({ // Adicione esta linha
            extract: true, // Extrai CSS em um arquivo separado
            minimize: production, // Minimize o CSS em produção
        }),
        resolve({
            browser: true,
            dedupe: ['svelte'],
        }),
        commonjs(),
        babel({
            babelHelpers: 'bundled',
            exclude: 'node_modules/**',
            presets: ['@babel/preset-env'],
        }),
        production && terser(), // Verifique se está assim
        serve({
            contentBase: 'public',
            historyApiFallback: true,
            port: 5000,
        }),
        livereload('public'),
    ],
    watch: {
        clearScreen: false,
    },
};
