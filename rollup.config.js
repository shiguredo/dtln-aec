import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';

const banner = `/**
 * ${pkg.name}
 * ${pkg.description}
 * @version: ${pkg.version}
 * @author: ${pkg.author}
 * @license: ${pkg.license}
 **/
`;

export default [
  {
    input: 'src/dtln_aec.ts',
    plugins: [
      typescript({module: "esnext"}),
      commonjs(),
      resolve(),
      copy({
        targets: [{
          src: [
            "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc.js",
            "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc.wasm",
            "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_simd.js",
            "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_simd.wasm",
            "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_threaded.js",
            "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_threaded.wasm",
            "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_simd_threaded.js",
            "./node_modules/@tensorflow/tfjs-tflite/dist/tflite_web_api_cc_simd_threaded.wasm"
          ],
          dest: 'dist/'
        }]
      })
    ],
    output: {
      sourcemap: false,
      file: './dist/dtln_aec.mjs',
      format: 'module',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  },
  {
    input: 'src/dtln_aec.ts',
    plugins: [
      typescript({module: "esnext"}),
      commonjs(),
      resolve()
    ],
    output: {
      sourcemap: false,
      file: './dist/dtln_aec.js',
      format: 'umd',
      name: 'Shiguredo',
      extend: true,
      banner: banner,
    }
  }
];
