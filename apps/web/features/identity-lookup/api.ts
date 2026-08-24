import { clientAuthHeaders, getApiUrl } from "@/lib/api";

export type IdentityLookupResult =
  | {
      apellidoMaterno: string;
      apellidoPaterno: string;
      departamento: string;
      direccion: string;
      distrito: string;
      nombre: string;
      nombres: string;
      numero: string;
      provincia: string;
      success: true;
      tipo: "DNI";
      ubigeo: string;
    }
  | {
      condicion: string;
      departamento: string;
      direccion: string;
      distrito: string;
      estado: string;
      nombre: string;
      numero: string;
      provincia: string;
      success: true;
      tipo: "RUC";
    };

export async function lookupIdentityDocument(documentNumber: string, companyId: string) {
  const normalized = documentNumber.trim();
  const query = new URLSearchParams({ companyId });
  const response = await fetch(`${getApiUrl()}/consultas/documentos/${encodeURIComponent(normalized)}?${query}`, {
    headers: clientAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "No se pudo consultar el documento.");
  }

  return response.json() as Promise<IdentityLookupResult>;
}
