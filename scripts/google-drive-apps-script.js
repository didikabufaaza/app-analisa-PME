/**
 * GOOGLE APPS SCRIPT: PME Google Drive Storage Bridge
 * 
 * Cara Penggunaan:
 * 1. Buka https://script.google.com/
 * 2. Buat "New project" (Proyek baru) dengan nama "SmartPME Drive Storage"
 * 3. Salin dan tempel semua kode di bawah ini ke editor script.
 * 4. Klik menu "Deploy" (Terapkan) -> "New deployment" (Penerapan baru).
 * 5. Pilih type: "Web app" (Aplikasi Web).
 * 6. Atur konfigurasi:
 *    - Description: "SmartPME Webhook"
 *    - Execute as: "Me (email Anda)"
 *    - Who has access: "Anyone" (Siapa saja)
 * 7. Klik "Deploy", izinkan akses akun Google Anda jika diminta.
 * 8. Salin "Web app URL" (contoh: https://script.google.com/macros/s/AKfycb.../exec)
 *    dan masukkan ke file .env di server Anda:
 *    GOOGLE_DRIVE_WEBHOOK_URL="https://script.google.com/macros/s/AKfycb.../exec"
 */

var TARGET_FOLDER_ID = "1pwCYPhj9MNQYK-TWmDQ4zbGi1CTZYXa2";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "upload";
    
    if (action === "upload") {
      var folderId = data.folderId || TARGET_FOLDER_ID;
      var folder = DriveApp.getFolderById(folderId);
      var fileName = data.fileName || ("pme_report_" + new Date().getTime() + ".pdf");
      var decoded = Utilities.base64Decode(data.base64);
      var blob = Utilities.newBlob(decoded, "application/pdf", fileName);
      var file = folder.createFile(blob);
      
      // Atur izin agar file dapat dibaca
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      var fileId = file.getId();
      var viewUrl = file.getUrl();
      var downloadUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
      
      return jsonResponse({
        ok: true,
        fileId: fileId,
        fileName: file.getName(),
        viewUrl: viewUrl,
        downloadUrl: downloadUrl
      });
    }
    
    if (action === "delete") {
      var targetFile = DriveApp.getFileById(data.fileId);
      targetFile.setTrashed(true);
      return jsonResponse({ ok: true });
    }
    
    return jsonResponse({ ok: false, error: "Aksi tidak dikenal" });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doGet(e) {
  try {
    var action = e.parameter.action || "download";
    var fileId = e.parameter.id;
    
    if (!fileId) {
      return jsonResponse({ ok: false, error: "Parameter id wajib diisi" });
    }
    
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    
    if (action === "view" || action === "download") {
      return ContentService.createTextOutput(Utilities.base64Encode(blob.getBytes()))
        .setMimeType(ContentService.MimeType.TEXT);
    }
    
    return jsonResponse({
      ok: true,
      fileId: file.getId(),
      fileName: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize()
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
