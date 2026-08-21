import type { Company } from "@/features/companies/types";

export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type AnnouncementAudienceScope = "ALL" | "COMPANIES" | "TEAMS" | "EMPLOYEES";
export type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "URGENT";

export type AnnouncementAudience = {
  id: string;
  company: Pick<Company, "id" | "name" | "slug"> | null;
  team: {
    id: string;
    name: string;
    slug: string;
    company: Pick<Company, "id" | "name" | "slug">;
  } | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    company: Pick<Company, "id" | "name" | "slug">;
  } | null;
};

export type Announcement = {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  status: AnnouncementStatus;
  priority: AnnouncementPriority;
  audienceScope: AnnouncementAudienceScope;
  publishAt: string | null;
  expiresAt: string | null;
  sendEmail: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  audiences: AnnouncementAudience[];
  metrics: AnnouncementMetrics;
};

export type AnnouncementMetrics = {
  estimatedRecipients: number;
  pendingCount: number;
  readCount: number;
  readRate: number;
};

export type AnnouncementRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  personalEmail: string | null;
  company: Pick<Company, "id" | "name" | "slug">;
  team: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type AnnouncementReader = {
  id: string;
  readAt: string;
  employee: AnnouncementRecipient;
};

export type AnnouncementDetail = Announcement & {
  emailQueue: {
    failed: number;
    pending: number;
    sent: number;
    skipped: number;
    total: number;
  };
  readers: AnnouncementReader[];
  pending: AnnouncementRecipient[];
};

export type AnnouncementsSummary = {
  total: number;
  published: number;
  scheduled: number;
  pinned: number;
  segmented: number;
};

export type AnnouncementsResult = {
  data: Announcement[];
  summary: AnnouncementsSummary;
};

export type AnnouncementPayload = {
  title: string;
  message: string;
  imageUrl?: string;
  status: AnnouncementStatus;
  priority: AnnouncementPriority;
  audienceScope: AnnouncementAudienceScope;
  companyIds: string[];
  teamIds: string[];
  employeeIds: string[];
  publishAt?: string;
  expiresAt?: string;
  sendEmail: boolean;
  isPinned: boolean;
};
