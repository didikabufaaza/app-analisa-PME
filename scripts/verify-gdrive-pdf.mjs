// scripts/verify-gdrive-pdf.mjs
import { promises as fs } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else if (contentType.includes("application/pdf")) {
    const buffer = await res.arrayBuffer();
    data = { bufferLength: buffer.byteLength, contentType, headers: Object.fromEntries(res.headers.entries()) };
  } else {
    data = await res.text();
  }
  return { status: res.status, headers: res.headers, data };
}

async function run() {
  console.log("=== VERIFIKASI INTEGRASI GOOGLE DRIVE & VALIDASI KETAT PDF ===\n");

  // 1. Login sebagai Superadmin
  console.log("1. Melakukan login Superadmin...");
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "superadmin@didikpme.id", password: "demo1234" }),
  });
  if (loginRes.status !== 200) {
    console.error("Login gagal:", loginRes.data);
    process.exit(1);
  }
  const cookie = loginRes.headers.get("set-cookie");
  console.log("Superadmin berhasil login. Status:", loginRes.status);

  // 2. Uji Penolakan Berkas Non-PDF
  console.log("\n2. Menguji penolakan berkas non-PDF...");
  
  // Kasus A: Ekstensi non-pdf (.txt)
  const fakeTxtFormData = new FormData();
  fakeTxtFormData.append("file", new Blob(["Halo ini bukan file PDF"], { type: "text/plain" }), "dokumen.txt");
  const rejectTxtRes = await request("/api/pme/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: fakeTxtFormData,
  });
  console.log(" - Unggah .txt -> Status:", rejectTxtRes.status, "(Ditolak:", rejectTxtRes.data.error || rejectTxtRes.data, ")");
  if (rejectTxtRes.status !== 400) {
    console.error("GAGAL: File .txt seharusnya ditolak dengan status 400!");
    process.exit(1);
  }

  // Kasus B: Ekstensi .pdf tetapi isi bukan PDF (Magic bytes palsu)
  const fakePdfFormData = new FormData();
  fakePdfFormData.append("file", new Blob(["Ini bukan PDF asli walaupun namanya .pdf"], { type: "application/pdf" }), "palsu.pdf");
  const rejectFakePdfRes = await request("/api/pme/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: fakePdfFormData,
  });
  console.log(" - Unggah PDF palsu (magic bytes salah) -> Status:", rejectFakePdfRes.status, "(Ditolak:", rejectFakePdfRes.data.error || rejectFakePdfRes.data, ")");
  if (rejectFakePdfRes.status !== 400) {
    console.error("GAGAL: PDF palsu seharusnya ditolak dengan status 400!");
    process.exit(1);
  }

  // 3. Uji Unggah Berkas PDF Valid
  console.log("\n3. Menguji unggah berkas PDF valid...");
  // Buat PDF minimal yang valid (%PDF-1.4 ...)
  const minimalValidPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000108 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF"
  );
  const validFormData = new FormData();
  validFormData.append("file", new Blob([minimalValidPdf], { type: "application/pdf" }), "laporan_uji_mutu.pdf");
  
  const uploadRes = await request("/api/pme/upload", {
    method: "POST",
    headers: { Cookie: cookie },
    body: validFormData,
  });

  console.log(" - Unggah PDF valid -> Status:", uploadRes.status);
  if (uploadRes.status !== 201) {
    console.error("GAGAL: PDF valid gagal diunggah:", uploadRes.data);
    process.exit(1);
  }
  const sessionId = uploadRes.data.session?.id;
  const driveFileId = uploadRes.data.session?.driveFileId;
  const driveViewUrl = uploadRes.data.session?.driveViewUrl;
  console.log(" - Sesi PME terbuat:", sessionId);
  console.log(" - Google Drive File ID:", driveFileId);
  console.log(" - Google Drive View URL:", driveViewUrl);

  // 4. Periksa detail sesi di DB
  console.log("\n4. Mengambil detail sesi untuk memverifikasi metadata Google Drive...");
  const detailRes = await request(`/api/pme/${sessionId}`, {
    headers: { Cookie: cookie },
  });
  console.log("Status:", detailRes.status);
  const sessionFile = detailRes.data.session?.file;
  console.log("Data File Sesi:");
  console.log(" - ID File:", sessionFile?.id);
  console.log(" - Nama Berkas:", sessionFile?.fileName);
  console.log(" - Drive File ID:", sessionFile?.driveFileId);
  console.log(" - Drive View URL:", sessionFile?.driveViewUrl);
  const fileId = sessionFile?.id;

  // 5. Uji Pengambilan dan Tampilan Berkas PDF via /api/files/:fileId
  console.log(`\n5. Menguji pembacaan berkas PDF via /api/files/${fileId}...`);
  const fileRes = await request(`/api/files/${fileId}`, {
    headers: { Cookie: cookie },
  });
  console.log("Status:", fileRes.status);
  console.log("Content-Type:", fileRes.data.contentType);
  console.log("Ukuran Buffer:", fileRes.data.bufferLength, "bytes");
  console.log("Storage Source:", fileRes.headers.get("x-storage-source"));

  if (fileRes.status !== 200 || !fileRes.data.contentType.includes("application/pdf")) {
    console.error("GAGAL: Berkas PDF tidak dapat dibaca dengan status 200!");
    process.exit(1);
  }

  // 6. Bersihkan sesi uji coba
  console.log(`\n6. Membersihkan sesi uji coba (${sessionId})...`);
  const delRes = await request(`/api/pme/${sessionId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  console.log("Status Hapus Sesi:", delRes.status);

  console.log("\n=== SEMUA PENGUJIAN SELESAI DENGAN SUKSES! ===");
}

run().catch((err) => {
  console.error("Terjadi kesalahan pada verifikasi:", err);
  process.exit(1);
});
