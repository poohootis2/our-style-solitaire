const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Vercel's Linux build workspace can write the generated web CSS cache.
  // Keep the local Windows path virtual to avoid node_modules permission errors.
  forceWriteFileSystem: process.env.VERCEL === "1",
});
