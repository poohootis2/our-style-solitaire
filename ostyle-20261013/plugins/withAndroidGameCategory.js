const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Marks the application as a game. Android 16 excludes games from the
 * large-screen orientation/resizability restriction changes.
 */
module.exports = function withAndroidGameCategory(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const application = manifestConfig.modResults.manifest.application?.[0];
    if (application) {
      application.$ = application.$ || {};
      application.$["android:appCategory"] = "game";
    }
    return manifestConfig;
  });
};
