import { Download, FileImage, FileText, FileType2 } from "lucide-react";
import { mediaUrl } from "@/lib/api";

export function DocumentFilePreview({
  actionLabel = "Descargar",
  className = "",
  fallbackName,
  fileName,
  fileSize,
  fileUrl,
  mimeType,
  showAction = true,
}: {
  actionLabel?: string;
  className?: string;
  fallbackName?: string | null;
  fileName: string | null;
  fileSize?: number | null;
  fileUrl: string | null;
  mimeType: string | null;
  showAction?: boolean;
}) {
  const href = fileUrl ? mediaUrl(fileUrl) : "";
  const displayName =
    readableFileName(fileName) ||
    fallbackFileName(fallbackName, fileName || fileNameFromUrl(fileUrl)) ||
    fileNameFromUrl(fileUrl) ||
    "Archivo sin nombre";
  const isImage = Boolean(href && mimeType?.startsWith("image/"));
  const typeLabel = documentFileTypeLabel(mimeType, displayName);

  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-2xl border border-[#dfe5ee] bg-white p-3 shadow-sm ${className}`}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e7ecf3] bg-[#f4f6ff] text-[#4f46e5]">
        {isImage ? (
          <img
            alt={displayName}
            className="h-full w-full object-cover"
            src={href}
          />
        ) : (
          <DocumentFileIcon mimeType={mimeType} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-5 text-[#1f242d]">
          {displayName}
        </p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">
          {typeLabel}
          {fileSize ? ` · ${formatFileSize(fileSize)}` : ""}
        </p>
      </div>
      {showAction ? (
        href ? (
          <a
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#eef2ff] px-3 text-xs font-bold text-[#4f46e5] transition hover:bg-[#dbe4ff]"
            href={href}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="h-4 w-4" />
            {actionLabel}
          </a>
        ) : (
          <span className="shrink-0 rounded-xl bg-[#f2f4f7] px-3 py-2 text-xs font-bold text-[#98a2b3]">
            Sin archivo
          </span>
        )
      ) : null}
    </div>
  );
}

function DocumentFileIcon({ mimeType }: { mimeType: string | null }) {
  if (mimeType?.startsWith("image/")) {
    return <FileImage className="h-6 w-6" />;
  }

  if (mimeType?.includes("word")) {
    return <FileType2 className="h-6 w-6" />;
  }

  return <FileText className="h-6 w-6" />;
}

function documentFileTypeLabel(mimeType: string | null, fileName: string) {
  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    return "PDF";
  }

  if (mimeType?.includes("word") || /\.(doc|docx)$/i.test(fileName)) {
    return "Word";
  }

  if (mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
    return "Imagen";
  }

  return "Archivo";
}

function fileNameFromUrl(fileUrl: string | null) {
  if (!fileUrl) return "";
  const cleanUrl = fileUrl.split("?")[0] ?? "";
  const segment = cleanUrl.split("/").filter(Boolean).at(-1) ?? "";
  return decodeURIComponent(segment);
}

function readableFileName(fileName: string | null) {
  if (!fileName || isGeneratedFileName(fileName)) return "";
  return fileName;
}

function fallbackFileName(fallbackName: string | null | undefined, currentName: string) {
  if (!fallbackName) return "";
  const extension = extensionFromName(currentName);
  return `${fallbackName}${extension}`;
}

function extensionFromName(fileName: string) {
  const match = fileName.match(/\.[a-z0-9]+$/i);
  return match?.[0] ?? "";
}

function isGeneratedFileName(fileName: string) {
  return /^\d{12,}-[a-z0-9]{6,}\.[a-z0-9]+$/i.test(fileName);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
