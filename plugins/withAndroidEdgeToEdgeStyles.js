const { withAndroidStyles } = require("@expo/config-plugins");

/**
 * Android 15+ uses edge-to-edge by default. Remove legacy theme attributes
 * that color or reserve the system bars so the app relies on safe-area insets.
 */
module.exports = function withAndroidEdgeToEdgeStyles(config) {
  return withAndroidStyles(config, (stylesConfig) => {
    const styles = stylesConfig.modResults.resources?.style ?? [];
    for (const style of styles) {
      if (style.$?.name !== "AppTheme") continue;
      style.item = (style.item ?? []).filter((item) => {
        const name = item.$?.name;
        return name !== "android:statusBarColor" && name !== "android:enforceNavigationBarContrast";
      });
    }
    return stylesConfig;
  });
};
