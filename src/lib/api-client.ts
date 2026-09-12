import { useAppStore } from "@/lib/store";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getTenantHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const tenantId = useAppStore.getState().viewAsTenantId;
    if (tenantId && tenantId.trim()) {
      return { "x-tenant-id": tenantId.trim() };
    }
  } catch {
    /* ignore */
  }
  return {};
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    throw new ApiError("Sesi berakhir. Silakan login kembali.", 401, "UNAUTHENTICATED");
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const message = (body && (body.error as string)) || `Permintaan gagal (${res.status})`;
    throw new ApiError(message, res.status, body?.code as string | undefined);
  }
  return body as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { ...getTenantHeaders() },
  });
  return handle<T>(res);
}

export async function apiSend<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { ...getTenantHeaders() };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { ...getTenantHeaders() },
    body: formData,
  });
  return handle<T>(res);
}

/** Download a file (PDF/XLSX) produced by the backend, with auth cookie. */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { ...getTenantHeaders() },
  });
  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json().catch(() => null) : null;
    throw new ApiError(body?.error || "Unduhan gagal", res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
