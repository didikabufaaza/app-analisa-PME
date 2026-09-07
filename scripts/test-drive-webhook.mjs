// scripts/test-drive-webhook.mjs
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzwCiK4dt01ysQzgywqUW4dqvVyJIlz0k_YcjwiMLr4NbnogFBzRMErA8H2pc5ZhB9IGQ/exec";
const FOLDER_ID = "1pwCYPhj9MNQYK-TWmDQ4zbGi1CTZYXa2";

// Buat berkas PDF uji coba
const minimalValidPdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n00000000108 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF"
);

async function testWebhook() {
  console.log("Menguji pengiriman berkas ke Google Drive Webhook...");
  console.log("URL:", WEBHOOK_URL);

  const payload = {
    action: "upload",
    folderId: FOLDER_ID,
    fileName: `TEST_PME_SMARTPME_${Date.now()}.pdf`,
    mimeType: "application/pdf",
    base64: minimalValidPdf.toString("base64"),
  };

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow", // Apps Script redirects to echo output
  });

  console.log("HTTP Status:", res.status);
  const text = await res.text();
  console.log("Response Body:", text);

  try {
    const json = JSON.parse(text);
    if (json.ok && json.fileId) {
      console.log("\n SUKSES BESAR! Berkas berhasil masuk ke Google Drive!");
      console.log(" - File ID:", json.fileId);
      console.log(" - Nama Berkas:", json.fileName);
      console.log(" - View URL:", json.viewUrl);
      console.log(" - Download URL:", json.downloadUrl);
    } else {
      console.error("❌ Webhook mengembalikan error:", json);
    }
  } catch (err) {
    console.error("Gagal parse JSON:", err);
  }
}

testWebhook().catch(console.error);
