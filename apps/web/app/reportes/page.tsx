import { getCurrentUser } from "@/features/auth/api";
import { getExportJobs } from "@/features/export-jobs/api";
import { ExportJobsView } from "@/features/export-jobs/export-jobs-view";
import { getServerToken } from "@/lib/server-auth";

export default async function ReportesPage() {
  const token = await getServerToken();
  const [currentUser, exportJobs] = await Promise.all([
    getCurrentUser(token),
    getExportJobs(token),
  ]);

  return <ExportJobsView currentUser={currentUser} exportJobs={exportJobs} />;
}
