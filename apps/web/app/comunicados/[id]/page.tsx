import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getAnnouncement } from "@/features/announcements/api";
import { AnnouncementDetailView } from "@/features/announcements/announcement-detail-view";
import { getCurrentUser } from "@/features/auth/api";
import { getServerToken } from "@/lib/server-auth";
import { notFound } from "next/navigation";

export default async function ComunicadoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const token = await getServerToken();
  const { id } = await params;
  const [announcement, currentUser] = await Promise.all([getAnnouncement(id, token), getCurrentUser(token)]);

  if (!announcement) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#1f242d]">
      <div className="grid min-h-screen lg:grid-cols-[216px_minmax(0,1fr)]">
        <AppSidebar activePath="/comunicados" currentUser={currentUser} />

        <section className="min-w-0">
          <AppTopbar currentUser={currentUser} eyebrow="Comunicados" title="Detalle y lectura" />
          <AnnouncementDetailView announcement={announcement} />
        </section>
      </div>
    </main>
  );
}
