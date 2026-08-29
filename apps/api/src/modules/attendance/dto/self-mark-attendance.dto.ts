export type SelfMarkAttendanceDto = {
  tenantSlug?: string;
  companySlug?: string;
  identifier: string;
  pin: string;
  action: 'CHECK_IN' | 'CHECK_OUT';
  latitude?: number;
  longitude?: number;
  locationConsent?: boolean;
  privacyNoticeVersion?: string;
};
