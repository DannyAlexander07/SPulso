export type UpdateAutomationRuleDto = {
  enabled?: boolean;
  priority?: string;
  thresholdCount?: number | string | null;
  thresholdDays?: number | string | null;
  thresholdHours?: number | string | null;
  windowDays?: number | string | null;
};
