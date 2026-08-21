export type AutomationRuleType =
  | "DOCUMENT_EXPIRING"
  | "DOCUMENT_EXPIRED"
  | "DOCUMENT_PENDING_SIGNATURE"
  | "REQUEST_PENDING"
  | "ATTENDANCE_LATE_REPEATED";

export type AutomationRule = {
  id: string;
  type: AutomationRuleType;
  name: string;
  description: string | null;
  enabled: boolean;
  thresholdDays: number | null;
  thresholdHours: number | null;
  thresholdCount: number | null;
  windowDays: number | null;
  priority: "INFO" | "WARNING" | "CRITICAL";
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type UpdateAutomationRulePayload = {
  enabled?: boolean;
  priority?: AutomationRule["priority"];
  thresholdCount?: number | null;
  thresholdDays?: number | null;
  thresholdHours?: number | null;
  windowDays?: number | null;
};
