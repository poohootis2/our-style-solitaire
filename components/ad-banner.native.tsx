import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { StyleSheet, View } from "react-native";
import { bannerAdUnitId, USE_TEST_ADS } from "@/lib/ad-config";

export function AdBanner({ compact = false, inline = false }: { compact?: boolean; inline?: boolean }) {
  return (
    <View style={[styles.container, compact && styles.containerCompact, inline && styles.containerInline]} accessibilityLabel={USE_TEST_ADS ? "테스트 광고 배너" : "광고 배너"}>
      <BannerAd
        unitId={bannerAdUnitId}
        size={compact ? BannerAdSize.BANNER : BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 50, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8, 15, 28, 0.92)" },
  containerCompact: { minHeight: 50, marginBottom: 2 },
  containerInline: { flex: 1, minWidth: 0 },
});
