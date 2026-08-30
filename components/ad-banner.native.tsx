import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { StyleSheet, View } from "react-native";

const PRODUCTION_BANNER_AD_UNIT_ID = "ca-app-pub-1567553177387474/7061604468";
const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_AD_UNIT_ID;

export function AdBanner() {
  return (
    <View style={styles.container} accessibilityLabel="광고 배너">
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 15, 28, 0.92)",
  },
});
