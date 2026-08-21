import type { AttendanceRecord, AttendanceRecordFilters } from "./types";

export function buildRecordCompanies(records: AttendanceRecord[]) {
  const map = new Map<string, { id: string; name: string }>();

  for (const record of records) {
    map.set(record.company.id, {
      id: record.company.id,
      name: record.company.name,
    });
  }

  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function filterAttendanceRecords(
  records: AttendanceRecord[],
  filters: AttendanceRecordFilters,
) {
  const search = filters.search?.trim().toLowerCase();

  return records.filter((record) => {
    if (filters.status && record.status !== filters.status) {
      return false;
    }

    if (filters.companyId && record.company.id !== filters.companyId) {
      return false;
    }

    if (search) {
      const searchableText = [
        record.employee.firstName,
        record.employee.lastName,
        record.employee.jobTitle ?? "",
        record.company.name,
        record.source,
        record.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(search)) {
        return false;
      }
    }

    return true;
  });
}
