/**
 * Object storage helper (PRD section #39).
 * PDFs are stored on the server filesystem under:
 *   /{organizationId}/pme/{sessionId}/original.pdf
 * The database only stores metadata and the file path.
 */
import { promises as fs } from "fs";
import { join } from "path";

const STORAGE_ROOT = process.env.STORAGE_ROOT || join(process.cwd(), "storage");

export function buildPmePdfPath(organizationId: string, sessionId: string): string {
  return join(STORAGE_ROOT, organizationId, "pme", sessionId, "original.pdf");
}

export async function savePmePdf(buffer: Buffer, organizationId: string, sessionId: string): Promise<string> {
  const filePath = buildPmePdfPath(organizationId, sessionId);
  await fs.mkdir(join(filePath, ".."), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readPmePdf(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export async function deleteSessionStorage(organizationId: string, sessionId: string): Promise<void> {
  const dir = join(STORAGE_ROOT, organizationId, "pme", sessionId);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
