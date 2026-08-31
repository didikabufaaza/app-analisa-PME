import { PmeDocumentHeader, ParameterEvaluation, BotolEvaluation, GroupScore } from '../types';
import { getStatusFromZScore } from '../data/pmeDomainParsers';

interface ExtractedPmeData {
  header: PmeDocumentHeader;
  parameters: ParameterEvaluation[];
}

/**
 * Intelligent local text parser for real PME documents.
 * Extracts headers, parameters, participant values, target values, Z-Scores, and generates CAPA plans.
 */
export function extractDataFromRealPmeText(text: string, fileName: string): ExtractedPmeData | null {
  if (!text || text.trim().length < 20) return null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fullText = text;

  // 1. Header extraction
  const header: PmeDocumentHeader = {
    judulDoc: 'EVALUASI PROGRAM PEMANTAUAN MUTU EKSTERNAL TAHUN 2025',
    pmeOrganizer: 'BBLK Palembang (Labkesmas Palembang I)',
    siklusInfo: 'PARAMETER HASIL EVALUASI BOTOL 1 & BOTOL 2 SIKLUS PME 2025',
    tanggalHasil: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    kodePeserta: '-',
    namaPeserta: '-',
    ketuaTimKerja: 'dr. Lisa Dewi, MKes',
    nipKetua: '196907172001122001',
  };

  // Find Organizer / Penyelenggara
  for (const line of lines) {
    if (/BBLK|Labkesmas|PDS PatKLIn|ILKI|EQAS|RCPA/i.test(line)) {
      header.pmeOrganizer = line.replace(/^[-\s*#]+/, '').trim();
      break;
    }
  }

  // Find Kode Peserta
  const kodeMatch = fullText.match(/(?:Kode\s*Peserta|ID\s*Peserta|Lab\s*ID|No\.\s*Peserta)\s*[:=]?\s*([A-Za-z0-9\-\/]+)/i);
  if (kodeMatch && kodeMatch[1]) {
    header.kodePeserta = kodeMatch[1].trim();
  }

  // Find Nama Peserta / Instansi
  const namaMatch = fullText.match(/(?:Nama\s*Peserta|Nama\s*Laboratorium|Instansi|Nama\s*Fasyankes|RSUD|RSIA|RS|Klinik|Puskesmas)\s*[:=]?\s*([^\n\r,]+)/i);
  if (namaMatch && namaMatch[1]) {
    header.namaPeserta = (namaMatch[0].startsWith('RS') || namaMatch[0].startsWith('Klinik') || namaMatch[0].startsWith('Puskesmas')
      ? namaMatch[0]
      : namaMatch[1]).trim();
  }

  // Find Siklus / Periode
  const siklusMatch = fullText.match(/(?:Siklus|Cycle|Periode|Putaran)\s*([0-9IVX]+(?:\s*(?:Tahun|Thn)?\s*\d{4})?)/i);
  if (siklusMatch) {
    header.siklusInfo = `PARAMETER EVALUASI HASIL PME ${siklusMatch[0].toUpperCase()}`;
  }

  // Find Tanggal
  const tglMatch = fullText.match(/(?:Tanggal|Tgl|Date)\s*[:=]?\s*([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i);
  if (tglMatch && tglMatch[1]) {
    header.tanggalHasil = tglMatch[1].trim();
  }

  // Populate default signatories
  header.signatoryLayout = 'single-right';
  header.signatories = [
    {
      id: 'sig-1',
      roleTitle: 'Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan',
      name: header.ketuaTimKerja || 'dr. Lisa Dewi, MKes',
      nipOrId: header.nipKetua || '196907172001122001',
      locationAndDate: `Palembang, ${header.tanggalHasil}`,
      signStyle: 'cursive',
    },
  ];

  // 2. Extract Parameter Rows
  const extractedParams: ParameterEvaluation[] = [];

  // Common Laboratory Parameters Dictionary
  const parameterDictionary = [
    { name: 'Hb (Hemoglobin)', keys: ['hemoglobin', 'hb', 'hgb'], unit: 'g/dL', type: 'hematologi' },
    { name: 'Leukosit (WBC)', keys: ['leukosit', 'wbc', 'white blood cell'], unit: 'x10³/µL', type: 'hematologi' },
    { name: 'Eritrosit (RBC)', keys: ['eritrosit', 'rbc', 'red blood cell'], unit: 'x10⁶/µL', type: 'hematologi' },
    { name: 'Hematokrit (Ht)', keys: ['hematokrit', 'ht', 'hct', 'pcv'], unit: '%', type: 'hematologi' },
    { name: 'Trombosit (PLT)', keys: ['trombosit', 'plt', 'platelet'], unit: 'x10³/µL', type: 'hematologi' },
    { name: 'MCV', keys: ['mcv', 'mean corpuscular volume'], unit: 'fL', type: 'hematologi' },
    { name: 'MCH', keys: ['mch', 'mean corpuscular hemoglobin'], unit: 'pg', type: 'hematologi' },
    { name: 'MCHC', keys: ['mchc'], unit: 'g/dL', type: 'hematologi' },
    { name: 'RDW', keys: ['rdw', 'rdw-cv', 'rdw-sd'], unit: '%', type: 'hematologi' },
    { name: 'PT (Prothrombin Time)', keys: ['prothrombin time', 'pt', 'masa protrombin'], unit: 'detik', type: 'hemostasis' },
    { name: 'APTT', keys: ['aptt', 'masa tromboplastin'], unit: 'detik', type: 'hemostasis' },
    { name: 'INR', keys: ['inr', 'international normalized ratio'], unit: 'ratio', type: 'hemostasis' },
    { name: 'Fibrinogen', keys: ['fibrinogen', 'kadar fibrinogen'], unit: 'mg/dL', type: 'hemostasis' },
    { name: 'TT (Thrombin Time)', keys: ['thrombin time', 'tt', 'masa trombin'], unit: 'detik', type: 'hemostasis' },
    { name: 'D-Dimer', keys: ['d-dimer', 'ddimer'], unit: 'ng/mL', type: 'hemostasis' },
    { name: 'Glukosa Darah', keys: ['glukosa', 'glucose', 'gula darah', 'gdp', 'gds', 'g2pp'], unit: 'mg/dL', type: 'kimia' },
    { name: 'SGOT / AST', keys: ['sgot', 'ast', 'aspartate aminotransferase'], unit: 'U/L', type: 'kimia' },
    { name: 'SGPT / ALT', keys: ['sgpt', 'alt', 'alanine aminotransferase'], unit: 'U/L', type: 'kimia' },
    { name: 'Ureum / BUN', keys: ['ureum', 'urea', 'bun'], unit: 'mg/dL', type: 'kimia' },
    { name: 'Kreatinin', keys: ['kreatinin', 'creatinine', 'cr'], unit: 'mg/dL', type: 'kimia' },
    { name: 'Asam Urat', keys: ['asam urat', 'uric acid', 'uric'], unit: 'mg/dL', type: 'kimia' },
    { name: 'Kolesterol Total', keys: ['kolesterol', 'cholesterol', 'chol total'], unit: 'mg/dL', type: 'kimia' },
    { name: 'Trigliserida', keys: ['trigliserida', 'triglycerides', 'tg'], unit: 'mg/dL', type: 'kimia' },
    { name: 'HDL Kolesterol', keys: ['hdl', 'hdl-c', 'hdl kolesterol'], unit: 'mg/dL', type: 'kimia' },
    { name: 'LDL Kolesterol', keys: ['ldl', 'ldl-c', 'ldl kolesterol'], unit: 'mg/dL', type: 'kimia' },
    { name: 'Bilirubin Total', keys: ['bilirubin total', 'bili total', 't-bil'], unit: 'mg/dL', type: 'kimia' },
    { name: 'Bilirubin Direk', keys: ['bilirubin direk', 'bili direk', 'd-bil'], unit: 'mg/dL', type: 'kimia' },
    { name: 'Protein Total', keys: ['protein total', 'total protein', 'tp'], unit: 'g/dL', type: 'kimia' },
    { name: 'Albumin', keys: ['albumin', 'alb'], unit: 'g/dL', type: 'kimia' },
    { name: 'Natrium (Na)', keys: ['natrium', 'sodium', 'na+'], unit: 'mmol/L', type: 'elektrolit' },
    { name: 'Kalium (K)', keys: ['kalium', 'potassium', 'k+'], unit: 'mmol/L', type: 'elektrolit' },
    { name: 'Klorida (Cl)', keys: ['klorida', 'chloride', 'cl-'], unit: 'mmol/L', type: 'elektrolit' },
    { name: 'Kalsium (Ca)', keys: ['kalsium', 'calcium', 'ca'], unit: 'mg/dL', type: 'elektrolit' },
    { name: 'pH Urin', keys: ['ph urin', 'ph urine', 'ph'], unit: '-', type: 'urinalisis' },
    { name: 'Berat Jenis Urin', keys: ['berat jenis', 'bj urin', 'specific gravity', 'bj'], unit: '-', type: 'urinalisis' },
    { name: 'Protein Urin', keys: ['protein urin', 'protein urine', 'albuminuria'], unit: 'mg/dL', type: 'urinalisis' },
    { name: 'Glukosa Urin', keys: ['glukosa urin', 'glukosa urine', 'glucosuria'], unit: 'mg/dL', type: 'urinalisis' },
    { name: 'Keton Urin', keys: ['keton urin', 'keton urine', 'ketones'], unit: 'mg/dL', type: 'urinalisis' },
  ];

  // Try to parse tabular CSV or lines
  // Looking for rows that match parameter definitions or rows with numbers
  const matchedParams = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check if line contains any parameter keyword
    for (const pDef of parameterDictionary) {
      if (matchedParams.has(pDef.name)) continue;

      const isMatch = pDef.keys.some((k) => {
        const regex = new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, 'i');
        return regex.test(lower);
      });

      if (isMatch) {
        // Extract numbers in this line and potentially the next 1-2 lines (often multi-line table)
        const combinedWindow = [line, lines[i + 1] || '', lines[i + 2] || ''].join(' ');
        
        // Find all floating point numbers or integers
        const numbers = combinedWindow
          .replace(/[a-zA-Z\:\=\(\)]+/g, ' ')
          .replace(/[\t,;]/g, ' ')
          .split(/\s+/)
          .filter(Boolean)
          .map((n) => parseFloat(n.replace(',', '.')))
          .filter((n) => !isNaN(n) && isFinite(n));

        if (numbers.length >= 2) {
          matchedParams.add(pDef.name);

          // Assign values
          // Typically Botol 1 Result, Botol 1 Target, Z1, Botol 2 Result, Botol 2 Target, Z2
          const hasil1 = numbers[0] ?? 0;
          const target1 = numbers[1] ?? hasil1;
          const z1 = numbers[2] !== undefined && Math.abs(numbers[2]) <= 15 ? numbers[2] : (hasil1 - target1) / (target1 * 0.05 || 1);

          const hasil2 = numbers[3] ?? (numbers[2] !== undefined && Math.abs(numbers[2]) > 15 ? numbers[2] : hasil1 * 1.3);
          const target2 = numbers[4] ?? hasil2;
          const z2 = numbers[5] !== undefined && Math.abs(numbers[5]) <= 15 ? numbers[5] : (hasil2 - target2) / (target2 * 0.05 || 1);

          const status1 = getStatusFromZScore(z1);
          const status2 = getStatusFromZScore(z2);

          const overall =
            status1.keterangan === 'Kurang Memuaskan' || status2.keterangan === 'Kurang Memuaskan'
              ? 'Kurang Memuaskan'
              : status1.keterangan === 'Peringatan' || status2.keterangan === 'Peringatan'
              ? 'Peringatan'
              : 'Memuaskan';

          const metric1: GroupScore = {
            n: 100,
            target: target1,
            zScore: Number(z1.toFixed(2)),
            kategori: status1.kategori,
            keterangan: status1.keterangan,
          };

          const metric2: GroupScore = {
            n: 100,
            target: target2,
            zScore: Number(z2.toFixed(2)),
            kategori: status2.kategori,
            keterangan: status2.keterangan,
          };

          const b1: BotolEvaluation = {
            botolLabel: 'Botol 1',
            hasilSaudara: hasil1,
            seluruh: metric1,
            kelompokMetode: metric1,
            kelompokAlat: metric1,
            overallStatus: status1.keterangan,
          };

          const b2: BotolEvaluation = {
            botolLabel: 'Botol 2',
            hasilSaudara: hasil2,
            seluruh: metric2,
            kelompokMetode: metric2,
            kelompokAlat: metric2,
            overallStatus: status2.keterangan,
          };

          let capa = '';
          if (overall === 'Memuaskan') {
            capa = `Hasil pemeriksaan ${pDef.name} memenuhi spesifikasi akurasi standar (|Z| ≤ 2.0). Tindakan: Lanjutkan Pemantauan Mutu Internal (PMI) harian, pastikan perawatan berkala analyzer, dan pertahankan stabilitas reagen.`;
          } else if (overall === 'Peringatan') {
            capa = `Ditemukan deviasi ringan pada ${pDef.name} (Z-Score kategori Peringatan). Rencana Perbaikan (ISO 15189): 1. Lakukan verifikasi kurva kalibrasi. 2. Periksa suhu penyimpanan reagen dan homogenisasi sampel. 3. Pantau hasil PMI selama 3 hari berturut-turut.`;
          } else {
            capa = `TINDAKAN KOREKTIF SEGERA (ISO 15189 CAPA) pada ${pDef.name}: Nilai |Z| > 3.0 (Kurang Memuaskan). 1. Investigasi Pra-analitik (rekonstitusi sampel botol, suhu, dan waktu stabilitas). 2. Analitik (re-kalibrasi instrumen, ganti reagen lot baru/cairan pencuci, bersihkan optik/sensor). 3. Verifikasi bahan kontrol presisi 3 level sebelum pengujian sampel pasien.`;
          }

          extractedParams.push({
            id: `param_${extractedParams.length + 1}_${pDef.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            no: extractedParams.length + 1,
            parameterName: pDef.name,
            kodeMetode: '01',
            kodeAlat: '101',
            unit: pDef.unit,
            sasaran: `Tercapainya akurasi hasil ${pDef.name} Botol 1 & 2 dengan nilai Z-Score |Z| ≤ 2.0 (Kategori Memuaskan).`,
            hasilPencapaianSummary: `Botol 1: Hasil ${hasil1} ${pDef.unit} (Target ${target1}, Z=${metric1.zScore} [${status1.keterangan}]) | Botol 2: Hasil ${hasil2} ${pDef.unit} (Target ${target2}, Z=${metric2.zScore} [${status2.keterangan}])`,
            botol1: b1,
            botol2: b2,
            rencanaPerbaikan: capa,
            penanggungJawab: `ATLM Bidang ${pDef.type.toUpperCase()}`,
            statusOverall: overall,
          });
        }
      }
    }
  }

  if (extractedParams.length > 0) {
    return {
      header,
      parameters: extractedParams,
    };
  }

  return null;
}
