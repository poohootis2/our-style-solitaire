const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Keep generated CSS inside the project so Vercel Metro can hash it reliably.
  output: "./.nativewind/web.css",
  forceWriteFileSystem: true,
});
