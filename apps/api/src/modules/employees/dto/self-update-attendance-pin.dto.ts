export type SelfUpdateAttendancePinDto = {
  tenantSlug?: string;
  companySlug?: string;
  identifier: string;
  currentPin: string;
  newPin: string;
};
