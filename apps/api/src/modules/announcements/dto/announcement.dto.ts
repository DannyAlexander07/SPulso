import type {
  AnnouncementAudienceScope,
  AnnouncementPriority,
  AnnouncementStatus,
} from '@prisma/client';

export type CreateAnnouncementDto = {
  title?: string;
  message?: string;
  imageUrl?: string;
  status?: AnnouncementStatus;
  priority?: AnnouncementPriority;
  audienceScope?: AnnouncementAudienceScope;
  companyIds?: string[];
  teamIds?: string[];
  employeeIds?: string[];
  publishAt?: string;
  expiresAt?: string;
  sendEmail?: boolean;
  isPinned?: boolean;
};

export type UpdateAnnouncementDto = Partial<CreateAnnouncementDto>;
