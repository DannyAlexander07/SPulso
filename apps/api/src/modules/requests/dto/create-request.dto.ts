import type { RequestType } from '@prisma/client';

export type CreateRequestDto = {
  employeeId: string;
  type: RequestType;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
};
