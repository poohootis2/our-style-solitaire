import { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from "react-native-google-mobile-ads";

const PRODUCTION_REWARDED_AD_UNIT_ID = "ca-app-pub-1567553177387474/9388077415";

export function showRewardedAd(): Promise<boolean> {
  const unitId = __DEV__ ? TestIds.REWARDED : PRODUCTION_REWARDED_AD_UNIT_ID;
  if (!unitId) return Promise.resolve(false);

  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: false });
    let rewarded = false;
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      resolve(value);
    };
    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => { ad.show().catch(() => finish(false)); });
    const unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { rewarded = true; });
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(rewarded));
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
    ad.load();
  });
}
