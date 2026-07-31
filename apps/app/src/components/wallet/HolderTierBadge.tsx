'use client';

import type { HolderTier } from '@xiom/blockchain';

const TIER_LABEL: Record<HolderTier, string> = {
  none: 'No tier',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

const TIER_CLASS: Record<HolderTier, string> = {
  none: 'border-white/15 text-white/40',
  bronze: 'border-orange-400/40 text-orange-200',
  silver: 'border-slate-300/40 text-slate-200',
  gold: 'border-yellow-400/40 text-yellow-200',
  platinum: 'border-cyan-300/40 text-cyan-100',
};

export default function HolderTierBadge({
  tier,
  loading,
}: {
  tier: HolderTier;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex px-2 py-0.5 text-[10px] uppercase tracking-widest border border-white/10 text-white/30">
        …
      </span>
    );
  }

  return (
    <span
      className={`inline-flex px-2 py-0.5 text-[10px] uppercase tracking-widest border ${TIER_CLASS[tier]}`}
      title="XIOM holder tier"
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
