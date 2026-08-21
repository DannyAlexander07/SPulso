import type { BenefitAudienceScope, BenefitStatus } from '@prisma/client';

export type CreateBenefitDto = {
  title?: string;
  category?: string;
  description?: string;
  status?: BenefitStatus;
  audienceScope?: BenefitAudienceScope;
  companyIds?: string[];
  teamIds?: string[];
  startsAt?: string;
  endsAt?: string;
  actionLabel?: string;
  actionUrl?: string;
  imageUrl?: string;
  isHighlighted?: boolean;
};

export type UpdateBenefitDto = Partial<CreateBenefitDto>;
