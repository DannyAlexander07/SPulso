export type CreateEmployeeDto = {
  companyId: string;
  areaId?: string | null;
  positionId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  firstName: string;
  lastName: string;
  documentNumber?: string;
  employeeCode?: string;
  attendancePin?: string;
  jobTitle?: string;
  area?: string;
  hireDate?: string;
};
