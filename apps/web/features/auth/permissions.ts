import type { AuthUser } from "./types";

export function canManageCompanies(user: AuthUser | null) {
  return hasPermission(user, "companies.manage");
}

export function canManageEmployees(user: AuthUser | null) {
  return hasPermission(user, "employees.manage");
}

export function canManageAttendance(user: AuthUser | null) {
  return hasPermission(user, "attendance.manage");
}

export function canManageRequests(user: AuthUser | null) {
  return hasPermission(user, "requests.approve");
}

export function canCreateRequests(user: AuthUser | null) {
  return hasPermission(user, "requests.create");
}

export function canManageDocuments(user: AuthUser | null) {
  return hasPermission(user, "documents.manage");
}

export function canViewAudit(user: AuthUser | null) {
  return hasPermission(user, "audit.view");
}

export function canViewCompanies(user: AuthUser | null) {
  return hasPermission(user, "companies.manage");
}

export function canViewDocuments(user: AuthUser | null) {
  return hasPermission(user, "documents.view");
}

export function canViewEmployees(user: AuthUser | null) {
  return hasPermission(user, "employees.view");
}

export function canViewAttendance(user: AuthUser | null) {
  return hasPermission(user, "attendance.view");
}

export function canViewRequests(user: AuthUser | null) {
  return hasPermission(user, "requests.view");
}

export function canViewReports(user: AuthUser | null) {
  return hasAnyPermission(user, [
    "documents.view",
    "employees.view",
    "requests.view",
    "users.manage",
  ]);
}

export function canViewNotifications(user: AuthUser | null) {
  return hasPermission(user, "notifications.view");
}

export function canViewAutomations(user: AuthUser | null) {
  return hasPermission(user, "automations.view");
}

export function canViewOrganization(user: AuthUser | null) {
  return hasPermission(user, "organization.view") || hasPermission(user, "organization.manage");
}

export function canManageOrganization(user: AuthUser | null) {
  return hasPermission(user, "organization.manage");
}

export function canViewBenefits(user: AuthUser | null) {
  return hasPermission(user, "benefits.view") || hasPermission(user, "benefits.manage");
}

export function canManageBenefits(user: AuthUser | null) {
  return hasPermission(user, "benefits.manage");
}

export function canViewAnnouncements(user: AuthUser | null) {
  return hasPermission(user, "announcements.view") || hasPermission(user, "announcements.manage");
}

export function canManageAnnouncements(user: AuthUser | null) {
  return hasPermission(user, "announcements.manage");
}

export function canManageUsers(user: AuthUser | null) {
  return hasPermission(user, "users.manage");
}

export function hasAnyPermission(user: AuthUser | null, permissions: string[]) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasPermission(user: AuthUser | null, permission: string) {
  const permissions = user?.permissions ?? user?.role?.permissions ?? [];
  return permissions.includes(permission);
}
