const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const nativeWindCacheDir = path.resolve(
  __dirname,
  "node_modules/react-native-css-interop/.cache",
);

fs.mkdirSync(nativeWindCacheDir, { recursive: true });
config.watchFolders = [
  ...(config.watchFolders ?? []),
  nativeWindCacheDir,
];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Keep generated CSS cache watched by Metro on Vercel.
  forceWriteFileSystem: true,
});
