"use client";

import { Badge } from "@/components/ui/badge";
import { getConfidenceTier, getConfidenceColorClasses } from "@/lib/ai/document-schemas";

interface ConfidenceBadgeProps {
  confidence: number | null;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps): React.JSX.Element | null {
  if (confidence === null || confidence === undefined) {
    return null;
  }

  const tier = getConfidenceTier(confidence);
  const colors = getConfidenceColorClasses(tier);

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <Badge className={`${colors.badge} ${className || ''}`} variant="secondary">
      {tierLabel}
    </Badge>
  );
}
