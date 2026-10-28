import { AdEventType, RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";
import { rewardedAdUnitId } from "@/lib/ad-config";

export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    let rewarded = false;
    let settled = false;
    const ad = RewardedAd.createForAdRequest(rewardedAdUnitId, { requestNonPersonalizedAdsOnly: false });
    let unsubscribeLoaded: () => void = () => undefined;
    let unsubscribeEarned: () => void = () => undefined;
    let unsubscribeClosed: () => void = () => undefined;
    let unsubscribeError: () => void = () => undefined;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      resolve(value);
    };

    unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      ad.show().catch(() => finish(false));
    });
    unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      rewarded = true;
    });
    unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(rewarded));
    unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
    ad.load();
  });
}
