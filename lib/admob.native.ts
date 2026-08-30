import mobileAds from "react-native-google-mobile-ads";

export function initializeAdMob() {
  return mobileAds().initialize();
}
