const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const nativeWindCacheDir = path.resolve(
  __dirname,
  "node_modules/react-native-css-interop/.cache",
);
const nativeWindWebCssPath = path.join(nativeWindCacheDir, "web.css");

fs.mkdirSync(nativeWindCacheDir, { recursive: true });
fs.closeSync(fs.openSync(nativeWindWebCssPath, "a"));
config.watchFolders = [
  ...(config.watchFolders ?? []),
  nativeWindCacheDir,
];

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
