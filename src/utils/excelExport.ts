import { ParameterEvaluation, PmeDocumentHeader, SignatoryItem } from '../types';

export function exportPmeToExcel(header: PmeDocumentHeader, parameters: ParameterEvaluation[]): boolean {
  try {
    const filenameBase = `Evaluasi_PME_Hematologi_${header.kodePeserta || 'Peserta'}_${(header.tanggalHasil || '2025').replace(/[^a-zA-Z0-9]/g, '_')}`;

    const signatories: SignatoryItem[] =
      header.signatories && header.signatories.length > 0
        ? header.signatories
        : [
            {
              id: 'sig-1',
              roleTitle: header.ketuaTimKerja || 'Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan',
              name: header.ketuaTimKerja || 'dr. Lisa Dewi, MKes',
              nipOrId: header.nipKetua || '196907172001122001',
              locationAndDate: `Palembang, ${header.tanggalHasil || '14 November 2025'}`,
              signStyle: 'cursive',
            },
          ];

    const layout = header.signatoryLayout || (signatories.length > 1 ? 'dual' : 'single-right');

    // Build Signatory HTML rows for Excel
    let signatureHtml = '';
    if (layout === 'dual' && signatories.length >= 2) {
      const sig1 = signatories[0];
      const sig2 = signatories[1];
      signatureHtml = `
        <tr><td colspan="5" style="border:none; height: 25px;"></td></tr>
        <tr>
          <td colspan="2" style="border:none; text-align: center; vertical-align: top;">
            <div style="font-size: 10pt;">${sig1.locationAndDate || ''}</div>
            <div style="font-size: 10pt; font-weight: bold; margin-top: 4px;">${(sig1.roleTitle || '').replace(/\n/g, '<br/>')}</div>
            <div style="height: 50px;"></div>
            <div style="font-size: 10pt; font-weight: bold; text-decoration: underline;">${sig1.name}</div>
            <div style="font-size: 9pt; color: #475569;">${sig1.nipOrId ? (sig1.nipOrId.startsWith('NIP') || sig1.nipOrId.startsWith('SIP') ? sig1.nipOrId : `NIP ${sig1.nipOrId}`) : '-'}</div>
          </td>
          <td style="border:none;"></td>
          <td colspan="2" style="border:none; text-align: center; vertical-align: top;">
            <div style="font-size: 10pt;">${sig2.locationAndDate || ''}</div>
            <div style="font-size: 10pt; font-weight: bold; margin-top: 4px;">${(sig2.roleTitle || '').replace(/\n/g, '<br/>')}</div>
            <div style="height: 50px;"></div>
            <div style="font-size: 10pt; font-weight: bold; text-decoration: underline;">${sig2.name}</div>
            <div style="font-size: 9pt; color: #475569;">${sig2.nipOrId ? (sig2.nipOrId.startsWith('NIP') || sig2.nipOrId.startsWith('SIP') ? sig2.nipOrId : `NIP ${sig2.nipOrId}`) : '-'}</div>
          </td>
        </tr>
      `;
    } else if (layout === 'triple' && signatories.length >= 3) {
      const sig1 = signatories[0];
      const sig2 = signatories[1];
      const sig3 = signatories[2];
      signatureHtml = `
        <tr><td colspan="5" style="border:none; height: 25px;"></td></tr>
        <tr>
          <td style="border:none; text-align: center; vertical-align: top;">
            <div style="font-size: 9pt;">${sig1.locationAndDate || ''}</div>
            <div style="font-size: 9pt; font-weight: bold;">${(sig1.roleTitle || '').replace(/\n/g, '<br/>')}</div>
            <div style="height: 45px;"></div>
            <div style="font-size: 9pt; font-weight: bold; text-decoration: underline;">${sig1.name}</div>
            <div style="font-size: 8pt; color: #475569;">${sig1.nipOrId ? (sig1.nipOrId.startsWith('NIP') ? sig1.nipOrId : `NIP ${sig1.nipOrId}`) : '-'}</div>
          </td>
          <td style="border:none;"></td>
          <td style="border:none; text-align: center; vertical-align: top;">
            <div style="font-size: 9pt;">${sig2.locationAndDate || ''}</div>
            <div style="font-size: 9pt; font-weight: bold;">${(sig2.roleTitle || '').replace(/\n/g, '<br/>')}</div>
            <div style="height: 45px;"></div>
            <div style="font-size: 9pt; font-weight: bold; text-decoration: underline;">${sig2.name}</div>
            <div style="font-size: 8pt; color: #475569;">${sig2.nipOrId ? (sig2.nipOrId.startsWith('NIP') ? sig2.nipOrId : `NIP ${sig2.nipOrId}`) : '-'}</div>
          </td>
          <td style="border:none;"></td>
          <td style="border:none; text-align: center; vertical-align: top;">
            <div style="font-size: 9pt;">${sig3.locationAndDate || ''}</div>
            <div style="font-size: 9pt; font-weight: bold;">${(sig3.roleTitle || '').replace(/\n/g, '<br/>')}</div>
            <div style="height: 45px;"></div>
            <div style="font-size: 9pt; font-weight: bold; text-decoration: underline;">${sig3.name}</div>
            <div style="font-size: 8pt; color: #475569;">${sig3.nipOrId ? (sig3.nipOrId.startsWith('NIP') ? sig3.nipOrId : `NIP ${sig3.nipOrId}`) : '-'}</div>
          </td>
        </tr>
      `;
    } else {
      const sig = signatories[signatories.length - 1] || signatories[0];
      const alignCol = layout === 'single-left' ? 'colspan="2"' : 'colspan="2"';
      const leftSpacing = layout === 'single-left' ? '' : '<td colspan="3" style="border:none;"></td>';
      const rightSpacing = layout === 'single-left' ? '<td colspan="3" style="border:none;"></td>' : '';

      signatureHtml = `
        <tr><td colspan="5" style="border:none; height: 25px;"></td></tr>
        <tr>
          ${leftSpacing}
          <td ${alignCol} style="border:none; text-align: center; vertical-align: top;">
            <div style="font-size: 10pt;">${sig.locationAndDate || ''}</div>
            <div style="font-size: 10pt; font-weight: bold; margin-top: 4px;">${(sig.roleTitle || '').replace(/\n/g, '<br/>')}</div>
            <div style="height: 50px;"></div>
            <div style="font-size: 10pt; font-weight: bold; text-decoration: underline;">${sig.name}</div>
            <div style="font-size: 9pt; color: #475569;">${sig.nipOrId ? (sig.nipOrId.startsWith('NIP') || sig.nipOrId.startsWith('SIP') ? sig.nipOrId : `NIP ${sig.nipOrId}`) : '-'}</div>
          </td>
          ${rightSpacing}
        </tr>
      `;
    }

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Evaluasi PME</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 10pt; color: #1e293b; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #475569; padding: 8px 10px; text-transform: uppercase; font-size: 9.5pt; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: top; font-size: 9.5pt; }
          .doc-header-title { font-size: 14pt; font-weight: bold; color: #0f172a; text-transform: uppercase; }
          .doc-meta { font-size: 10pt; color: #334155; font-weight: 600; }
          .meta-label { color: #64748b; font-weight: normal; width: 140px; }
          .group-banner { background-color: #e0e7ff; color: #1e1b4b; font-weight: bold; font-size: 10pt; }
          .badge-good { color: #065f46; font-weight: bold; }
          .badge-warn { color: #92400e; font-weight: bold; }
          .badge-bad { color: #991b1b; font-weight: bold; }
          .sample-card { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 6px; margin-bottom: 6px; font-size: 9pt; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="5" class="doc-header-title">${header.judulDoc || 'LAPORAN EVALUASI CAPAIAN PARAMETER PME'}</td></tr>
          <tr><td colspan="5" style="border:none; height: 6px;"></td></tr>
          <tr><td colspan="5" class="doc-meta"><strong>Penyelenggara PME:</strong> ${header.pmeOrganizer || '-'}</td></tr>
          <tr><td colspan="5" class="doc-meta"><strong>Tanggal Hasil:</strong> ${header.tanggalHasil || '-'}</td></tr>
          <tr><td colspan="5" class="doc-meta"><strong>Peserta:</strong> ${header.namaPeserta || '-'} (${header.kodePeserta || '-'})</td></tr>
          <tr><td colspan="5" class="doc-meta"><strong>Siklus / Program:</strong> ${header.siklusInfo || '-'}</td></tr>
          <tr><td colspan="5" style="border:none; height: 12px;"></td></tr>

          <!-- Table Header Columns -->
          <tr>
            <th style="width: 45px;">No.</th>
            <th style="width: 220px;">Sasaran</th>
            <th style="width: 380px;">Hasil Pencapaian</th>
            <th style="width: 380px;">Rencana Perbaikan</th>
            <th style="width: 180px;">Penanggung Jawab</th>
          </tr>

          ${parameters
            .map((p) => {
              const b1StatusClass =
                p.botol1.overallStatus === 'Kurang Memuaskan'
                  ? 'badge-bad'
                  : p.botol1.overallStatus === 'Peringatan'
                  ? 'badge-warn'
                  : 'badge-good';

              const b2StatusClass =
                p.botol2.overallStatus === 'Kurang Memuaskan'
                  ? 'badge-bad'
                  : p.botol2.overallStatus === 'Peringatan'
                  ? 'badge-warn'
                  : 'badge-good';

              return `
            <!-- Parameter Group Row -->
            <tr class="group-banner">
              <td style="text-align: center; font-weight: bold; background-color: #c7d2fe;">${p.no}</td>
              <td colspan="4" style="background-color: #e0e7ff; font-weight: bold; color: #1e1b4b;">
                PARAMETER: ${p.parameterName} (Kode Metode: ${p.kodeMetode}, Kode Alat: ${p.kodeAlat}) &mdash; [Status: ${p.statusOverall}]
              </td>
            </tr>

            <!-- Detailed Data Row -->
            <tr>
              <td style="text-align: center; color: #64748b;">${p.no}</td>
              <td style="font-weight: 500;">${p.sasaran}</td>
              <td>
                <div class="sample-card">
                  <strong>Botol 1 (Normal):</strong> Hasil: <strong>${p.botol1.hasilSaudara} ${p.unit}</strong> <span class="${b1StatusClass}">[${p.botol1.overallStatus}]</span><br/>
                  Target: ${p.botol1.seluruh.target} | Z-Score: Seluruh ${p.botol1.seluruh.zScore} (${p.botol1.seluruh.keterangan}), Metode ${p.botol1.kelompokMetode.zScore} (${p.botol1.kelompokMetode.keterangan}), Alat ${p.botol1.kelompokAlat.zScore} (${p.botol1.kelompokAlat.keterangan})
                </div>
                <div class="sample-card">
                  <strong>Botol 2 (Tinggi):</strong> Hasil: <strong>${p.botol2.hasilSaudara} ${p.unit}</strong> <span class="${b2StatusClass}">[${p.botol2.overallStatus}]</span><br/>
                  Target: ${p.botol2.seluruh.target} | Z-Score: Seluruh ${p.botol2.seluruh.zScore} (${p.botol2.seluruh.keterangan}), Metode ${p.botol2.kelompokMetode.zScore} (${p.botol2.kelompokMetode.keterangan}), Alat ${p.botol2.kelompokAlat.zScore} (${p.botol2.kelompokAlat.keterangan})
                </div>
              </td>
              <td style="white-space: pre-line;">${p.rencanaPerbaikan || '-'}</td>
              <td style="font-weight: 600; text-align: center;">${p.penanggungJawab || '-'}</td>
            </tr>
          `;
            })
            .join('')}

          ${signatureHtml}

          <!-- Footer Watermark in Excel -->
          <tr><td colspan="5" style="border:none; height: 15px;"></td></tr>
          <tr>
            <td colspan="5" style="border:none; font-size: 8pt; color: #94a3b8; text-align: center; text-transform: uppercase;">
              Dokumen Resmi Laporan Evaluasi PME - ${header.pmeOrganizer || 'Laboratorium Kesehatan'}
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Prepend UTF-8 BOM so Excel opens indonesian characters perfectly
    const blob = new Blob(['\uFEFF' + htmlContent], {
      type: 'application/vnd.ms-excel;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenameBase}.xls`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);

    return true;
  } catch (error) {
    console.error('Error exporting PME to Excel:', error);
    return false;
  }
}
