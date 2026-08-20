Vendored third-party client-side libraries, served locally so the app works
without depending on a CDN at runtime.

- **zxing.min.js** — [@zxing/library](https://github.com/zxing-js/library)
  v0.21.3, UMD build (`node_modules/@zxing/library/umd/index.min.js`),
  Apache-2.0 license. Used for camera-based barcode scanning. Exposes a
  global `ZXing` object. To update: `npm install @zxing/library@<version>`
  then re-copy `node_modules/@zxing/library/umd/index.min.js` here.

- **tesseract/** — [Tesseract.js](https://github.com/naptha/tesseract.js)
  v7.0.0 (Apache-2.0), used for on-device OCR of receipt photos. Fully
  vendored — including the English language model — so OCR needs no CDN
  and works offline once the page has loaded. Exposes a global
  `Tesseract` object with `createWorker`.
  - `tesseract.min.js` — main API (`node_modules/tesseract.js/dist/tesseract.min.js`)
  - `worker.min.js` — the worker script (`node_modules/tesseract.js/dist/worker.min.js`), passed as `workerPath`
  - `tesseract-core-lstm.wasm.js` — the LSTM-only WASM engine, non-SIMD
    for broad compatibility, with the `.wasm` binary embedded as base64 so
    no separate file/MIME-type handling is needed
    (`node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js`), passed as `corePath`
  - `eng.traineddata.gz` — English language data, the `4.0.0_best_int`
    variant matching `lstmOnly` mode, from the
    [`@tesseract.js-data/eng`](https://www.npmjs.com/package/@tesseract.js-data/eng)
    npm package (`node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz`),
    passed as `langPath` (a directory)
  - To update: bump the four npm devDependencies
    (`@zxing/library`, `tesseract.js`, `tesseract.js-core`,
    `@tesseract.js-data/eng`), then re-copy each file from the paths above.
