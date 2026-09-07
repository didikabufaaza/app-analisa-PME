/**
 * Google Drive Storage Service
 * Handles uploading, downloading, and managing PME PDF files in Google Drive.
 * Target Folder: https://drive.google.com/drive/folders/1pwCYPhj9MNQYK-TWmDQ4zbGi1CTZYXa2
 */

import { JWT } from "google-auth-library";

export const DEFAULT_DRIVE_FOLDER_ID = "1pwCYPhj9MNQYK-TWmDQ4zbGi1CTZYXa2";

export interface DriveUploadResult {
  fileId: string;
  driveViewUrl: string;
  driveDownloadUrl: string;
  source: "GOOGLE_DRIVE_SERVICE_ACCOUNT" | "GOOGLE_DRIVE_WEBHOOK" | "LOCAL_FALLBACK";
}

function getFolderId(): string {
  return process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || DEFAULT_DRIVE_FOLDER_ID;
}

/**
 * Obtain an OAuth2 access token using Google Cloud Service Account
 */
async function getServiceAccountToken(): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();

  if (!email || !key) return null;

  // Handle escaped newlines in private key
  key = key.replace(/\\n/g, "\n");

  try {
    const auth = new JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    const { token } = await auth.getAccessToken();
    return token || null;
  } catch (err) {
    console.error("[GoogleDrive] Service Account auth error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Upload a PDF buffer to Google Drive
 */
export async function uploadPdfToDrive(
  buffer: Buffer,
  fileName: string,
  targetFolderId?: string
): Promise<DriveUploadResult> {
  const folderId = targetFolderId || getFolderId();

  // 1. Try Google Cloud Service Account if configured
  const token = await getServiceAccountToken();
  if (token) {
    try {
      const boundary = `-------314159265358979323846`;
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: fileName,
        mimeType: "application/pdf",
        parents: [folderId],
      };

      const multipartRequestBody = Buffer.concat([
        Buffer.from(
          `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
        ),
        Buffer.from(`${delimiter}Content-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
        Buffer.from(buffer.toString("base64")),
        Buffer.from(closeDelimiter),
      ]);

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[GoogleDrive] Upload API failed (${res.status}):`, errText);
      } else {
        const data = (await res.json()) as { id: string; webViewLink?: string; webContentLink?: string };
        const fileId = data.id;
        const driveViewUrl = data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
        const driveDownloadUrl = data.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`;

        console.log(`[GoogleDrive] Successfully uploaded "${fileName}" to Drive ID: ${fileId}`);
        return {
          fileId,
          driveViewUrl,
          driveDownloadUrl,
          source: "GOOGLE_DRIVE_SERVICE_ACCOUNT",
        };
      }
    } catch (err) {
      console.error("[GoogleDrive] Service Account upload exception:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Try Google Apps Script Webhook if configured
  const webhookUrl = process.env.GOOGLE_DRIVE_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      const payload = {
        action: "upload",
        folderId,
        fileName,
        mimeType: "application/pdf",
        base64: buffer.toString("base64"),
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "follow",
      });

      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; fileId?: string; viewUrl?: string; downloadUrl?: string; error?: string };
        if (data.fileId) {
          console.log(`[GoogleDrive] Successfully uploaded via Webhook to Drive ID: ${data.fileId}`);
          return {
            fileId: data.fileId,
            driveViewUrl: data.viewUrl || `https://drive.google.com/file/d/${data.fileId}/view`,
            driveDownloadUrl: data.downloadUrl || `https://drive.google.com/uc?export=download&id=${data.fileId}`,
            source: "GOOGLE_DRIVE_WEBHOOK",
          };
        }
        console.warn("[GoogleDrive] Webhook returned error:", data.error);
      }
    } catch (err) {
      console.error("[GoogleDrive] Webhook upload exception:", err instanceof Error ? err.message : err);
    }
  }

  // 3. Resilient Fallback (Folder Reference)
  // When credentials are not yet configured, files are safely kept in local storage,
  // while retaining the target Google Drive folder link for tracking.
  const fallbackId = `local_pme_${Date.now()}`;
  return {
    fileId: fallbackId,
    driveViewUrl: `https://drive.google.com/drive/folders/${folderId}`,
    driveDownloadUrl: "",
    source: "LOCAL_FALLBACK",
  };
}

/**
 * Download a PDF buffer from Google Drive by fileId
 */
export async function downloadPdfFromDrive(driveFileId: string): Promise<Buffer | null> {
  if (!driveFileId || driveFileId.startsWith("local_")) {
    return null;
  }

  // 1. Try Service Account
  const token = await getServiceAccountToken();
  if (token) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      console.warn(`[GoogleDrive] Service account download failed with status ${res.status}`);
    } catch (err) {
      console.error("[GoogleDrive] Service account download exception:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Try Google Apps Script Webhook
  const webhookUrl = process.env.GOOGLE_DRIVE_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      const res = await fetch(`${webhookUrl}?action=download&id=${encodeURIComponent(driveFileId)}`, {
        redirect: "follow",
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/pdf")) {
          return Buffer.from(await res.arrayBuffer());
        }
        const data = (await res.json()) as { ok?: boolean; base64?: string };
        if (data.base64) {
          return Buffer.from(data.base64, "base64");
        }
      }
    } catch (err) {
      console.error("[GoogleDrive] Webhook download exception:", err instanceof Error ? err.message : err);
    }
  }

  // 3. Try direct public link export if file is publicly accessible
  try {
    const directUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
    const res = await fetch(directUrl, { redirect: "follow" });
    if (res.ok && (res.headers.get("content-type") || "").includes("application/pdf")) {
      return Buffer.from(await res.arrayBuffer());
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Delete a file from Google Drive
 */
export async function deletePdfFromDrive(driveFileId: string): Promise<boolean> {
  if (!driveFileId || driveFileId.startsWith("local_")) {
    return true;
  }

  // 1. Coba melalui Google Cloud Service Account jika dikonfigurasi
  const token = await getServiceAccountToken();
  if (token) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const success = res.ok || res.status === 404;
      if (success) {
        console.log(`[GoogleDrive] Berkas ${driveFileId} berhasil dihapus via Service Account.`);
      }
      return success;
    } catch (err) {
      console.error(`[GoogleDrive] Gagal menghapus via Service Account (${driveFileId}):`, err);
      return false;
    }
  }

  // 2. Coba melalui Google Apps Script Webhook
  const webhookUrl = process.env.GOOGLE_DRIVE_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", fileId: driveFileId }),
        redirect: "follow",
      });
      if (res.ok) {
        try {
          const json = await res.json();
          console.log(`[GoogleDrive] Respon hapus webhook (${driveFileId}):`, json);
          return json.ok !== false;
        } catch {
          return true;
        }
      }
      console.warn(`[GoogleDrive] Webhook delete HTTP status: ${res.status}`);
      return false;
    } catch (err) {
      console.error(`[GoogleDrive] Gagal memanggil webhook delete (${driveFileId}):`, err);
      return false;
    }
  }

  return false;
}
