import { AdEventType, RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";
import { rewardedAdUnitId } from "@/lib/ad-config";

type RewardedInstance = ReturnType<typeof RewardedAd.createForAdRequest>;

let rewardedAd: RewardedInstance | null = null;
let loadPromise: Promise<RewardedInstance> | null = null;
let showPromise: Promise<boolean> | null = null;
let isLoaded = false;
const LOAD_TIMEOUT_MS = 15_000;

function getAd(): RewardedInstance {
  if (!rewardedAd) {
    rewardedAd = RewardedAd.createForAdRequest(rewardedAdUnitId, { requestNonPersonalizedAdsOnly: true });
    isLoaded = false;
  }
  return rewardedAd;
}

function loadAd(): Promise<RewardedInstance> {
  if (isLoaded) return Promise.resolve(getAd());
  if (loadPromise) return loadPromise;
  const ad = getAd();
  loadPromise = new Promise<RewardedInstance>((resolve, reject) => {
    let settled = false;
    const loaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => finish());
    const failed = ad.addAdEventListener(AdEventType.ERROR, (error) => finish(error instanceof Error ? error : new Error("광고 로드 실패")));
    const timeout = setTimeout(() => finish(new Error("광고 로드 시간 초과")), LOAD_TIMEOUT_MS);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      loaded();
      failed();
      loadPromise = null;
      if (error) {
        isLoaded = false;
        rewardedAd = null;
        reject(error);
      } else {
        isLoaded = true;
        resolve(ad);
      }
    };
    try {
      ad.load();
    } catch (error) {
      finish(error instanceof Error ? error : new Error("광고 로드 시작 실패"));
    }
  });
  return loadPromise;
}

async function showRewardedAdInternal(): Promise<boolean> {
  try {
    const ad = await loadAd();
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let earned = false;
      const reward = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
      const error = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
      const closed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned));
      const timeout = setTimeout(() => finish(earned), LOAD_TIMEOUT_MS + 5_000);
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reward();
        error();
        closed();
        isLoaded = false;
        rewardedAd = null;
        loadPromise = null;
        // Warm up the next request, but never delay or duplicate the current reward.
        void loadAd().catch(() => undefined);
        resolve(result);
      };
      try {
        ad.show();
      } catch {
        finish(false);
      }
    });
  } catch {
    return false;
  }
}

export function showRewardedAd(): Promise<boolean> {
  if (showPromise) return showPromise;
  showPromise = showRewardedAdInternal().finally(() => {
    showPromise = null;
  });
  return showPromise;
}
