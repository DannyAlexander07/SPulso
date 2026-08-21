"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { mediaUrl } from "@/lib/api";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useRef, useState } from "react";
import { updatePortalProfilePhoto, uploadPortalProfileImage } from "./api";
import type { PortalEmployee } from "./types";

type FormState = "idle" | "loading" | "success" | "error";

export function PortalProfilePhotoForm({ employee }: { employee: PortalEmployee }) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(employee.user?.avatarUrl ?? "");
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullName = `${employee.firstName} ${employee.lastName}`;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setState("error");
      setMessage("Solo se permite JPG, PNG o WebP.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setState("error");
      setMessage("La foto debe pesar maximo 50 MB.");
      return;
    }

    setState("loading");
    setMessage("");

    try {
      const uploaded = await uploadPortalProfileImage(file);
      await updatePortalProfilePhoto(uploaded.url);
      setAvatarUrl(uploaded.url);
      setState("success");
      setMessage("Foto actualizada.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la foto.");
    }
  }

  async function removePhoto() {
    setState("loading");
    setMessage("");

    try {
      await updatePortalProfilePhoto(null);
      setAvatarUrl("");
      setState("success");
      setMessage("Foto quitada.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo quitar la foto.");
    }
  }

  return (
    <div className="rounded-2xl border border-[#e1e5eb] bg-[#fbfcfd] p-3">
      <input
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef2ff] text-sm font-bold text-[#4f46e5]">
          {avatarUrl ? (
            <img alt={fullName} className="h-full w-full object-cover" src={mediaUrl(avatarUrl)} />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#1f242d]">Foto de perfil</p>
          <p className="mt-0.5 text-xs leading-5 text-[#667085]">Se sincroniza con Usuarios y Trabajadores.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(79,70,229,0.18)] transition hover:bg-[#4338ca] disabled:opacity-60"
          disabled={state === "loading"}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Cambiar foto
        </button>
        {avatarUrl ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d8dee8] bg-white px-3 text-sm font-semibold text-[#475467] transition hover:border-[#ef4444] hover:text-[#b42318] disabled:opacity-60"
            disabled={state === "loading"}
            onClick={removePhoto}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Quitar
          </button>
        ) : null}
      </div>

      {state !== "idle" && message ? (
        <div className="mt-3">
          <ActionFeedback message={message} tone={state === "error" ? "error" : state === "loading" ? "loading" : "success"} />
        </div>
      ) : null}
    </div>
  );
}
