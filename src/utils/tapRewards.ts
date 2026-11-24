export interface TapRewardResult {
  rewardCount: number;
  residue: number;
}

export function consumeTapRewards(
  storedLikes: number,
  incomingLikes: number,
  threshold: number
): TapRewardResult {
  const safeStored = Number.isFinite(storedLikes) ? Math.max(0, storedLikes) : 0;
  const safeIncoming = Number.isFinite(incomingLikes) ? Math.max(0, Math.floor(incomingLikes)) : 0;
  const safeThreshold = Number.isFinite(threshold) ? Math.max(1, Math.floor(threshold)) : 1;
  let likes = safeStored + safeIncoming;
  let rewardCount = 0;

  while (likes >= safeThreshold) {
    likes -= safeThreshold;
    rewardCount++;
  }

  return { rewardCount, residue: likes };
}
