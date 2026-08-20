Vendored third-party client-side libraries, served locally so the app works
without depending on a CDN at runtime.

- **zxing.min.js** — [@zxing/library](https://github.com/zxing-js/library)
  v0.21.3, UMD build (`node_modules/@zxing/library/umd/index.min.js`),
  Apache-2.0 license. Used for camera-based barcode scanning. Exposes a
  global `ZXing` object. To update: `npm install @zxing/library@<version>`
  then re-copy `node_modules/@zxing/library/umd/index.min.js` here.
