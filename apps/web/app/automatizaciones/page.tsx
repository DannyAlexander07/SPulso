import { getAutomationRules } from "@/features/automations/api";
import { AutomationsView } from "@/features/automations/automations-view";
import { getCurrentUser } from "@/features/auth/api";
import { getServerToken } from "@/lib/server-auth";

export default async function AutomationsPage() {
  const token = await getServerToken();
  const [currentUser, rules] = await Promise.all([
    getCurrentUser(token),
    getAutomationRules(token),
  ]);

  return <AutomationsView currentUser={currentUser} rules={rules} />;
}
