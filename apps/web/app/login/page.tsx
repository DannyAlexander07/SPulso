import { LoginForm } from "@/features/auth/login-form";
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

export default function LoginPage() {
  return (
    <main className="h-dvh overflow-hidden bg-[#f3f5f8] text-[#20242c]">
      <section className="grid h-full lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden min-h-0 overflow-hidden border-r border-[#dfe5ee] bg-white px-10 py-8 lg:flex lg:flex-col">
          <div className="absolute inset-x-10 top-8 h-32 rounded-full bg-[#c7d2fe]/60 blur-3xl" />

          <div className="relative z-10 flex shrink-0 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#4f46e5] text-sm font-bold text-white shadow-[0_18px_38px_rgba(79,70,229,0.24)]">
                SP
              </div>
              <div>
                <p className="text-base font-semibold">SPulso</p>
                <p className="text-sm text-[#667085]">People operations</p>
              </div>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#475467]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0284c7]" />
              Acceso seguro
            </span>
          </div>

          <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[0.92fr_1.08fr] items-center gap-8">
            <div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#a5b4fc] bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#4f46e5]">
                <Activity className="h-3.5 w-3.5" />
                Centro operativo del grupo
              </div>
              <h1 className="mt-5 max-w-xl text-[42px] font-semibold leading-[1.06] tracking-normal text-[#171b23]">
                Gestion humana clara, rapida y automatizada.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[#667085]">
                Controla Grupo SP, Mood, Infinity y Supernova desde una experiencia unificada para asistencia, solicitudes, documentos y alertas.
              </p>

              <div className="mt-7 grid max-w-lg grid-cols-2 gap-3">
                <PreviewItem icon={Building2} label="4 empresas activas" value="Grupo SP" />
                <PreviewItem icon={UsersRound} label="Trabajadores" value="Conectados" />
                <PreviewItem icon={Clock3} label="Asistencia diaria" value="75% hoy" />
                <PreviewItem icon={FileText} label="Documentos" value="Al dia" />
              </div>
            </div>

            <div className="animate-rise rounded-[24px] border border-[#dfe5ee] bg-[#f9fbfd] p-4 shadow-[0_30px_80px_rgba(16,24,40,0.10)]">
              <div className="rounded-[20px] border border-[#e4e9f1] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                      Hoy
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">Pulso operativo</h2>
                  </div>
                  <span className="rounded-full bg-[#e0f2fe] px-3 py-1 text-xs font-bold text-[#0284c7]">
                    Online
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-[#edf1f6] bg-[#f8fafc] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#475467]">Asistencia registrada</span>
                    <span className="font-semibold text-[#4f46e5]">75%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#e6ebf2]">
                    <div className="h-full w-3/4 rounded-full bg-[#4f46e5]" />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <TimelineItem title="Alejandro marco entrada" meta="08:02 a. m." />
                  <TimelineItem title="Solicitud aprobada" meta="Vacaciones · Mood" />
                  <TimelineItem title="Documento firmado" meta="Contrato · Infinity" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden px-5 py-5 sm:px-8 lg:px-12">
          <section className="w-full max-w-[440px] animate-rise">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#4f46e5] text-sm font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.24)]">
                  SP
                </div>
                <div>
                  <p className="text-lg font-semibold">SPulso</p>
                  <p className="text-sm text-[#667085]">Acceso unificado</p>
                </div>
              </div>
              <span className="rounded-full border border-[#bae6fd] bg-[#e0f2fe] px-2.5 py-1 text-xs font-bold text-[#0284c7]">
                Seguro
              </span>
            </div>

            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                Iniciar sesión
              </p>
              <h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-normal text-[#171b23]">
                Bienvenido de nuevo.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#667085]">
                Ingresa y SPulso te llevara al panel que corresponde a tus permisos.
              </p>
            </div>

            <LoginForm />
          </section>
        </div>
      </section>
    </main>
  );
}

function PreviewItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e4e9f1] bg-white p-3 shadow-[0_16px_40px_rgba(16,24,40,0.05)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-sm font-semibold text-[#20242c]">{label}</p>
      <p className="mt-1 text-xs text-[#667085]">{value}</p>
    </div>
  );
}

function TimelineItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#edf1f6] bg-white p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e0f2fe] text-[#0284c7]">
        <CheckCircle2 className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#20242c]">{title}</p>
        <p className="truncate text-xs text-[#667085]">{meta}</p>
      </div>
    </div>
  );
}
