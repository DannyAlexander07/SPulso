import type { Company } from "@/features/companies/types";

export type BenefitStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
export type BenefitAudienceScope = "ALL" | "COMPANIES" | "TEAMS";

export type BenefitAudience = {
  id: string;
  company: Pick<Company, "id" | "name" | "slug"> | null;
  team: {
    id: string;
    name: string;
    slug: string;
    company: Pick<Company, "id" | "name" | "slug">;
  } | null;
};

export type Benefit = {
  id: string;
  title: string;
  category: string;
  description: string;
  status: BenefitStatus;
  audienceScope: BenefitAudienceScope;
  startsAt: string | null;
  endsAt: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  imageUrl: string | null;
  isHighlighted: boolean;
  createdAt: string;
  updatedAt: string;
  audiences: BenefitAudience[];
};

export type BenefitsSummary = {
  total: number;
  active: number;
  highlighted: number;
  segmented: number;
};

export type BenefitsResult = {
  data: Benefit[];
  summary: BenefitsSummary;
};

export type BenefitPayload = {
  title: string;
  category: string;
  description: string;
  status: BenefitStatus;
  audienceScope: BenefitAudienceScope;
  companyIds: string[];
  teamIds: string[];
  startsAt?: string;
  endsAt?: string;
  actionLabel?: string;
  actionUrl?: string;
  imageUrl?: string;
  isHighlighted: boolean;
};
