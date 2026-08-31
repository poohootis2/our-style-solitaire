import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { StyleSheet, View } from "react-native";

const PRODUCTION_BANNER_AD_UNIT_ID = "ca-app-pub-1567553177387474/7061604468";
const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_AD_UNIT_ID;

export function AdBanner({ compact = false, inline = false }: { compact?: boolean; inline?: boolean }) {
  return (
    <View style={[styles.container, compact && styles.containerCompact, inline && styles.containerInline]} accessibilityLabel="광고 배너">
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={compact ? BannerAdSize.BANNER : BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
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
  containerCompact: {
    marginBottom: 2,
  },
  containerInline: {
    flex: 1,
    minWidth: 0,
  },
});
