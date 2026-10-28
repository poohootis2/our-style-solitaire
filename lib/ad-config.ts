import { Platform } from "react-native";

/** AdMob app ID is configured in app.config.ts via the Expo config plugin. */
export const ANDROID_ADMOB_APP_ID = "ca-app-pub-1567553177387474~9687767806";
export const BANNER_AD_UNIT_ID = "ca-app-pub-1567553177387474/7061604468";
export const REWARDED_AD_UNIT_ID = "ca-app-pub-1567553177387474/9388077415";

// Google-provided demo IDs. They are safe to use during development.
export const TEST_BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/9214589741";
export const TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";

// Never request production ads during development. Release builds use the
// production IDs after the ad units have been verified in a test device.
export const USE_TEST_ADS = __DEV__;

export const bannerAdUnitId = Platform.OS === "android" && !USE_TEST_ADS ? BANNER_AD_UNIT_ID : TEST_BANNER_AD_UNIT_ID;
export const rewardedAdUnitId = Platform.OS === "android" && !USE_TEST_ADS ? REWARDED_AD_UNIT_ID : TEST_REWARDED_AD_UNIT_ID;
