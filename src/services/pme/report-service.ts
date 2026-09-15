/**
 * Report Generator (PRD sections #55, #56)
 * - PDF Model 1: Laporan Komprehensif dengan Cover, Identitas, Executive Summary,
 *   Tabel Hasil, dan Tabel Analisis Z-Score Komprehensif (Interpretasi, Kemungkinan Penyebab,
 *   Langkah Investigasi, Tindakan Korektif, dan Tindakan Preventif).
 * - PDF Model 2: Format Evaluasi Mutu Sasaran/Perbaikan (5 kolom sesuai template EVALUASI PME.xlsx).
 * - Excel Model 1: Full export teknis dengan seluruh metadata dan analisis AI.
 * - Excel Model 2: Format tepat sesuai file template EVALUASI PME.xlsx (No, Sasaran, Hasil Pencapain, Rencana Perbaikan, Penanggung Jawab).
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  SATISFACTORY: "Memuaskan",
  WARNING: "Peringatan",
  UNSATISFACTORY: "Tidak Memuaskan",
};

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return Number(n).toFixed(digits).replace(/\.?0+$/, "") || "0";
}

function fmtZ(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}`;
}

/**
 * Evaluasi tingkat keparahan baris Z-Score:
 * - "UNSATISFACTORY" (merah) bila ada status UNSATISFACTORY atau |Z| >= 3.0
 * - "WARNING" (kuning) bila ada status WARNING atau 2.0 < |Z| < 3.0
 * - "SATISFACTORY" bila semua memenuhi batas toleransi (|Z| <= 2.0)
 * - "NOT_ANALYZED" bila tidak ada nilai Z-Score atau berstatus tidak dianalisa
 */
export function getRowEvaluationLevel(r: {
  zScore?: number | null;
  zStatus?: string | null;
  instrumentZScore?: number | null;
  instrumentStatus?: string | null;
  methodZScore?: number | null;
  methodStatus?: string | null;
  allParticipantsZScore?: number | null;
  allParticipantsStatus?: string | null;
}): "UNSATISFACTORY" | "WARNING" | "SATISFACTORY" | "NOT_ANALYZED" {
  if (r.zStatus === "UNSATISFACTORY") return "UNSATISFACTORY";

  const statuses = [r.zStatus, r.instrumentStatus, r.methodStatus, r.allParticipantsStatus];
  for (const s of statuses) {
    if (!s) continue;
    const up = s.toUpperCase();
    if (up.includes("UNSATISFACTORY") || up.includes("TIDAK MEMUASKAN") || up.includes("TIDAK BAIK") || up.includes("$$")) {
      return "UNSATISFACTORY";
    }
  }

  const scores = [r.zScore, r.instrumentZScore, r.methodZScore, r.allParticipantsZScore].filter(
    (z): z is number => typeof z === "number" && !isNaN(z)
  );
  for (const z of scores) {
    if (Math.abs(z) >= 3.0) {
      return "UNSATISFACTORY";
    }
  }

  if (r.zStatus === "WARNING") return "WARNING";

  for (const s of statuses) {
    if (!s) continue;
    const up = s.toUpperCase();
    if (up.includes("WARNING") || up.includes("PERINGATAN") || up.includes("WASPAD")) {
      return "WARNING";
    }
  }

  for (const z of scores) {
    if (Math.abs(z) > 2.0 && Math.abs(z) < 3.0) {
      return "WARNING";
    }
  }

  if (scores.length > 0 || r.zStatus === "SATISFACTORY") {
    return "SATISFACTORY";
  }

  return "NOT_ANALYZED";
}

export function getOverallStatusLabel(r: {
  zStatus?: string | null;
  validationStatus?: string | null;
  instrumentStatus?: string | null;
  methodStatus?: string | null;
  allParticipantsStatus?: string | null;
  zScore?: number | null;
  instrumentZScore?: number | null;
  methodZScore?: number | null;
  allParticipantsZScore?: number | null;
}): string {
  const level = getRowEvaluationLevel(r);
  if (level === "UNSATISFACTORY") return "Tidak Memuaskan";
  if (level === "WARNING") return "Peringatan";
  if (level === "SATISFACTORY") return "Memuaskan";
  if (level === "NOT_ANALYZED") return "-";
  if (r.zStatus && STATUS_LABEL[r.zStatus]) return STATUS_LABEL[r.zStatus];
  if (r.validationStatus === "REVIEW_REQUIRED") return "Perlu Review";
  return "-";
}

function safeParseArray(json: string | null | undefined): unknown[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatList(arr: unknown[], bullet = "•"): string {
  if (!arr || arr.length === 0) return "-";
  return arr
    .map((item) => {
      if (typeof item === "string") return `${bullet} ${item}`;
      if (item && typeof item === "object") {
        const c = item as { category?: string; text?: string };
        const cat = c.category ? `[${c.category.replace(/_/g, " ")}] ` : "";
        return `${bullet} ${cat}${c.text || ""}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

interface FishboneItem {
  category: string;
  label: string;
  rootCause: string;
  action: string;
}

function resolveFishboneAnalysis(r: {
  parameterName: string;
  method?: string | null;
  instrument?: string | null;
  zScore?: number | null;
  instrumentZScore?: number | null;
  methodZScore?: number | null;
  allParticipantsZScore?: number | null;
  zStatus?: string | null;
  aiAnalysis?: {
    fishboneAnalysis?: string | null;
    possibleCauses?: string | null;
    correctiveActions?: string | null;
    biasAnalysis?: string | null;
    interpretation?: string | null;
  } | null;
}): FishboneItem[] {
  const a = r.aiAnalysis;
  if (a?.fishboneAnalysis) {
    try {
      const parsed = JSON.parse(a.fishboneAnalysis);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as FishboneItem[];
      }
    } catch {}
  }

  const zVal = r.allParticipantsZScore ?? r.zScore ?? 0;
  const isUnsat = Math.abs(zVal) >= 3.0 || r.zStatus === "UNSATISFACTORY";
  const isHigh = zVal > 0;
  const zSign = isHigh ? "positif (overestimasi / hasil lebih tinggi)" : "negatif (underestimasi / hasil lebih rendah)";
  const param = r.parameterName;
  const pLower = param.toLowerCase();
  const inst = r.instrument || "Instrumen otomatis laboratorium";
  const meth = r.method || "Metode standar";

  // 1. Parameter Hitungan Indeks Eritrosit (MCH, MCV, MCHC)
  if (/\b(mch|mcv|mchc|indeks eritrosit|red cell indices)\b/i.test(pLower)) {
    const isMCH = /\bmch\b/i.test(pLower);
    const isMCV = /\bmcv\b/i.test(pLower);
    const isMCHC = /\bmchc\b/i.test(pLower);
    const formulaDesc = isMCH
      ? "MCH = (Hb × 10) / RBC (komputasi rasio hemoglobin terhadap jumlah eritrosit)"
      : isMCV
      ? "MCV = (Ht × 10) / RBC (komputasi rasio hematokrit terhadap jumlah eritrosit)"
      : isMCHC
      ? "MCHC = (Hb / Ht) × 100 (rasio hemoglobin terhadap volume eritrosit padat)"
      : "Indeks eritrosit terhitung matematis dari parameter primer Hb, RBC, dan Ht";

    return [
      {
        category: "MAN",
        label: "1. Man (SDM / Personel)",
        rootCause: isUnsat
          ? `Teknik homogenisasi kontrol whole blood hematologi tidak memadai (inversi tabung kurang dari 8–10 kali) atau penundaan pembacaan setelah pencampuran, memicu sedimentasi seluler sehingga pembacaan Hb dan hitung RBC tidak proporsional.`
          : `Variasi minor kecepatan dan durasi pembalikan tabung darah antar analis saat pergantian shift, sedikit mempengaruhi keseragaman suspensi eritrosit saat aspirasi.`,
        action: isUnsat
          ? `Hentikan sementara verifikasi hasil indeks eritrosit, lakukan pelatihan ulang teknik inversi perlahan tabung kontrol (8–10 kali secara terstandar tanpa mengocok/frothing), dan lakukan uji blind duplicate.`
          : `Tingkatkan kedisiplinan SOP homogenisasi darah otomatis/manual dan catat waktu tunggu pra-analitik sebelum running sampel.`,
      },
      {
        category: "MACHINE",
        label: "2. Machine (Alat / Instrumen)",
        rootCause: isUnsat
          ? `Gangguan pada channel detektor primer pembentuk ${param}: terjadi micro-clot / penumpukan protein pada orifice aperture RBC impedance, atau drift kalibrasi optik fotometer Hb (540 nm). [Catatan: ${param} tidak memiliki sensor terpisah, error berasal dari sensor Hb atau RBC].`
          : `Fluktuasi tegangan sensor atau penumpukan deposit tipis pada aperture bath yang menyebabkan pergeseran baseline nilai hitung eritrosit atau hemoglobin.`,
        action: isUnsat
          ? `Lakukan deep cleaning aperture (zap / backflush / cell-clean) pada chamber RBC, bersihkan optical flow cell Hb, pastikan background count 0, lalu kalibrasi ulang channel primer (Hb & RBC) dengan calibrator whole blood fresh.`
          : `Jalankan siklus flush harian, periksa tekanan vakum aspirasi, dan verifikasi kestabilan background count instrumen ${inst}.`,
      },
      {
        category: "METHOD",
        label: "3. Method (Metode & Algoritma)",
        rootCause: isUnsat
          ? `Deviasi formula perhitungan software analyzer (${formulaDesc}) akibat pergeseran koefisien kalibrasi salah satu parameter input atau adanya interferensi lipemia/kekeruhan sampel yang mengacaukan optik Hb.`
          : `Perbedaan kurva normalisasi algoritma software antar tipe hematology analyzer terhadap konsensus kelompok metode.`,
        action: isUnsat
          ? `Audit konstanta dan formula perhitungan pada software ${inst}, cek ada/tidaknya interferensi optik (lipemia/ikterik), dan validasi linearitas channel Hb serta RBC.`
          : `Verifikasi kecocokan target nilai indeks eritrosit pada lembar kit insert kontrol terhadap model hematology analyzer yang digunakan.`,
      },
      {
        category: "MATERIAL",
        label: "4. Material (Bahan Kontrol Whole Blood)",
        rootCause: isUnsat
          ? `Kerusakan integritas seluler pada vial kontrol hematologi PME (lisis eritrosit dini, clumping) akibat paparan suhu di luar rantai dingin 2–8°C atau vial telah melampaui batas masa simpan pasca-buka (open-vial). [Catatan: tidak ada reagen khusus ${param}].`
          : `Vial kontrol hematologi mendekati batas akhir stabilitas pasca-buka (open-vial stability) sehingga volume seluler eritrosit mengalami sedikit pengerutan/pembengkakan.`,
        action: isUnsat
          ? `Buka vial kontrol hematologi baru yang masih tersegel dan tersimpan pada refrigerator 2–8°C stabil, lakukan aklimatisasi 15 menit pada suhu ruang, lalu homogenisasi secara menyeluruh.`
          : `Beri label tanggal buka yang jelas pada vial kontrol, simpan dalam posisi tegak pada suhu 2–8°C terpantau, dan hindari pembekuan kontrol.`,
      },
      {
        category: "ENVIRONMENT",
        label: "5. Environment (Lingkungan Lab)",
        rootCause: isUnsat
          ? `Suhu ruang hematologi melebihi 28°C atau berfluktuasi ekstrem, merubah viskositas cairan diluent pada orifice aperture dan mempercepat lisis eritrosit oleh reagen lyse.`
          : `Variasi suhu harian ruangan analitik yang mendekati batas toleransi atas (rentang ideal 18–25°C).`,
        action: isUnsat
          ? `Stabilkan suhu pendingin ruangan (AC) laboratorium pada rentang 20–22°C selama 24 jam dan posisikan alat hematologi jauh dari pancaran sinar matahari atau aliran panas ventilasi.`
          : `Lakukan pencatatan suhu dan kelembaban pada termohigrometer terkalibrasi dua kali sehari di area instrumen hematologi.`,
      },
      {
        category: "MEASUREMENT",
        label: "6. Measurement (Pengukuran & Kalibrasi)",
        rootCause: isUnsat
          ? `Faktor kalibrasi channel RBC atau optik fotometer Hb bergeser signifikan pasca penggantian suku cadang tanpa re-kalibrasi menggunakan calibrator resmi terakreditasi.`
          : `Sedikit pergeseran nilai calibrator hematologi atau variasi kalibrasi mikropipet pada preparasi predilusi manual.`,
        action: isUnsat
          ? `Lakukan kalibrasi resmi ulang (calibration run) menyeluruh untuk parameter RBC dan Hb menggunakan hematology calibrator terakreditasi pabrikan, lalu verifikasi ulang nilai MCH, MCV, dan MCHC.`
          : `Pantau grafik Levey-Jennings kontrol harian MCH/MCV untuk mendeteksi tren pergeseran (shift/trend) sesuai aturan Westgard.`,
      },
    ];
  }

  // 2. Parameter Hitungan Biokimia Lainnya (Globulin, eGFR, Bilirubin Indirek, Rasio A/G, LDL Indirek)
  if (/\b(globulin|egfr|gfr|bilirubin indirek|indirect bilirubin|rasio a\/g|ldl indirek|friedewald)\b/i.test(pLower)) {
    return [
      {
        category: "MAN",
        label: "1. Man (SDM / Personel)",
        rootCause: isUnsat
          ? `Kesalahan penanganan sampel atau input data manual nilai komponen primer pada software LIS/analyzer yang mendasari perhitungan ${param}.`
          : `Keterlambatan input data atau pembulatan angka desimal komponen primer yang memicu variasi deviasi minor.`,
        action: isUnsat
          ? `Periksa ulang seluruh data mentah komponen primer penyusun ${param}, pastikan tidak ada kesalahan ketik/transkripsi, dan lakukan verifikasi ganda.`
          : `Terapkan verifikasi otomatis pada LIS untuk mencegah kesalahan pembulatan angka hitungan.`,
      },
      {
        category: "MACHINE",
        label: "2. Machine (Alat / Instrumen)",
        rootCause: isUnsat
          ? `Deviasi kumulatif pada dua channel fotometrik pengukuran primer di alat ${inst} yang menghasilkan distorsi signifikan pada hasil perhitungan matematis ${param}.`
          : `Sedikit drift pada salah satu filter panjang gelombang channel fotometer komponen primer.`,
        action: isUnsat
          ? `Lakukan pengecekan fotometer dan kalibrasi ulang independen pada masing-masing channel analit primer pembentuk ${param}.`
          : `Jalankan pembersihan kuvet dan verifikasi baseline absorban channel fotometrik terkait.`,
      },
      {
        category: "METHOD",
        label: "3. Method (Metode & Rumus Perhitungan)",
        rootCause: isUnsat
          ? `Formula komputasi matematis pada software analyzer tidak sesuai dengan kit insert standar PME (misal: penggunaan rumus estimasi yang berbeda).`
          : `Perbedaan batas cutoff atau formula turunan terhadap metode konsensus penyelenggara PME.`,
        action: isUnsat
          ? `Validasi dan cocokkan rumus matematis pada sistem LIS/analyzer terhadap acuan resmi kit insert penyelenggara PME.`
          : `Dokumentasikan spesifikasi formula hitungan pada dokumen kontrol mutu laboratorium.`,
      },
      {
        category: "MATERIAL",
        label: "4. Material (Bahan Kontrol & Reagen Primer)",
        rootCause: isUnsat
          ? `Kerusakan atau degradasi pada salah satu reagen analit primer penyusun ${param}, menyebabkan bias ${zSign} yang berlipat ganda pada hasil hitungan.`
          : `Salah satu reagen primer mendekati tanggal kedaluwarsa atau terjadi variasi lot-to-lot minor.`,
        action: isUnsat
          ? `Evaluasi performa QC kedua analit primer, ganti reagen yang menunjukkan deviasi dengan lot baru, dan uji kontrol ulang.`
          : `Lakukan uji kesesuaian lot baru (cross-check lot) sebelum reagen primer digunakan dalam pelayanan rutin.`,
      },
      {
        category: "ENVIRONMENT",
        label: "5. Environment (Lingkungan Lab)",
        rootCause: isUnsat
          ? `Suhu ruang analitik berfluktuasi tajam mempengaruhi kecepatan reaksi salah satu analit enzimatik primer.`
          : `Fluktuasi suhu minor ruangan yang mendekati ambang batas atas toleransi alat biokimia.`,
        action: isUnsat
          ? `Pertahankan suhu ruangan pada 20–22°C stabil 24 jam dengan pendingin udara terkontrol.`
          : `Lakukan monitoring termohigrometer berkala per shift kerja di ruang analitik.`,
      },
      {
        category: "MEASUREMENT",
        label: "6. Measurement (Pengukuran & Kalibrator)",
        rootCause: isUnsat
          ? `Kurva kalibrasi salah satu parameter primer tidak valid atau nilai kalibrator pabrikan mengalami pergeseran target.`
          : `Ketidakpastian pengukuran (measurement uncertainty) gabungan dari kedua parameter primer.`,
        action: isUnsat
          ? `Kalibrasi ulang kedua parameter primer dengan kalibrator standar resmi pabrikan dan verifikasi presisi IQC.`
          : `Hitung evaluasi Total Error (TE) dan bandingkan dengan batas toleransi Total Error Allowable (TEa).`,
      },
    ];
  }

  // 3. Hematologi Pengukuran Langsung (Hb, Leukosit, Trombosit, Eritrosit, Hematokrit)
  if (/\b(hemoglobin|hb|hematokrit|ht|pcv|leukosit|wbc|trombosit|plt|platelet|eritrosit|rbc|led|esr)\b/i.test(pLower)) {
    return [
      {
        category: "MAN",
        label: "1. Man (SDM / Personel)",
        rootCause: isUnsat
          ? `Teknik pencampuran (mixing) sampel kontrol hematologi yang tidak sempurna sebelum aspirasi atau aspirasi gelembung udara akibat volume sampel pada tabung kurang memadai.`
          : `Variasi waktu tunggu antara homogenisasi tabung darah dengan waktu penusukan jarum aspirator.`,
        action: isUnsat
          ? `Lakukan re-edukasi SOP homogenisasi spesimen hematologi (inversi 8–10 kali perlahan) dan pastikan jarum aspirator menembus kedalaman sampel yang tepat.`
          : `Pastikan sampel segera diperiksa setelah proses homogenisasi selesai dilakukan.`,
      },
      {
        category: "MACHINE",
        label: "2. Machine (Alat / Instrumen)",
        rootCause: isUnsat
          ? `Terjadi penyumbatan parsial (partial clog / protein buildup) pada aperture transducer ${inst}, fluktuasi tekanan vakum/pompa diluter, atau keausan selang peristaltik.`
          : `Sedikit penumpukan debris reagen pada chamber pengukuran yang menyebabkan kenaikan noise/background count.`,
        action: isUnsat
          ? `Lakukan pembersihan intensif aperture (aperture burn / zap cleaning), ganti selang peristaltik bila elastisitas menurun, dan cek nilai background count (harus nol).`
          : `Jalankan siklus autowash dan daily maintenance sesuai manual pabrikan ${inst}.`,
      },
      {
        category: "METHOD",
        label: "3. Method (Metode Pemeriksaan)",
        rootCause: isUnsat
          ? `Metode lisis tidak tuntas (incomplete RBC lysis) atau interferensi partikel seluler abnormal yang mendistorsi histogram / scattergram populasi sel.`
          : `Karakteristik kurva diskriminator elektrik alat terhadap ambang batas ukuran sel kelompok metode ${meth}.`,
        action: isUnsat
          ? `Tinjau kurva histogram/scattergram hasil running, evaluasi waktu reaksi lisis reagen, dan pastikan setting discriminator threshold sesuai instruksi kit insert.`
          : `Lakukan verifikasi batas deteksi dan batas linearitas metode ${meth}.`,
      },
      {
        category: "MATERIAL",
        label: "4. Material (Reagen & Kontrol Hematologi)",
        rootCause: isUnsat
          ? `Reagen lyse atau diluent terkontaminasi mikropartikel, kedaluwarsa, atau kontrol hematologi PME mengalami agregasi/aglutinasi akibat pembekuan.`
          : `Reagen diluent/lyse mendekati batas akhir pemakaian on-board atau perubahan suhu penyimpanan botol reagen cadangan.`,
        action: isUnsat
          ? `Ganti reagen diluent dan lyse dengan lot baru yang terverifikasi, periksa kejernihan cairan diluent, dan gunakan vial kontrol baru bersuhu 2–8°C.`
          : `Pastikan botol reagen tertutup rapat untuk mencegah evaporasi dan catat tanggal buka reagen.`,
      },
      {
        category: "ENVIRONMENT",
        label: "5. Environment (Lingkungan Lab)",
        rootCause: isUnsat
          ? `Getaran mekanik yang kuat dari meja kerja (misal: sentrifus berada dekat analyzer) atau grounding kelistrikan yang buruk memicu lonjakan arus semu (electrical noise).`
          : `Fluktuasi suhu ruangan analitik yang merubah kecepatan reaksi enzimatik reagen lisis.`,
        action: isUnsat
          ? `Pindahkan instrumen hematologi ke meja anti-getaran tersendiri, cek kabel grounding kelistrikan (< 2 Volt), dan pasang UPS on-line terisolasi.`
          : `Pertahankan suhu ruang analitik pada 20–22°C stabil dengan termohigrometer terpantau.`,
      },
      {
        category: "MEASUREMENT",
        label: "6. Measurement (Pengukuran & Kalibrasi)",
        rootCause: isUnsat
          ? `Faktor kalibrasi gain channel ${param} mengalami pergeseran signifikan (drift) pasca servis tanpa dikalibrasi ulang dengan whole blood calibrator resmi.`
          : `Pergeseran nilai kalibrasi minor yang terakumulasi selama siklus pemakaian rutin.`,
        action: isUnsat
          ? `Jalankan kalibrasi penuh (multipoint calibration) menggunakan whole blood calibrator resmi dan evaluasi %CV presisi harian.`
          : `Evaluasi tren grafik Levey-Jennings kontrol mutu internal dan bandingkan dengan batas deviasi yang diizinkan.`,
      },
    ];
  }

  // 4. Kimia Klinik Enzim (SGOT, SGPT, GGT, ALP, Amilase, LDH, CK)
  if (/\b(sgot|ast|sgpt|alt|gamma gt|ggt|alkali fosfatase|alp|ck|ck-mb|ldh|amilase|lipase)\b/i.test(pLower)) {
    return [
      {
        category: "MAN",
        label: "1. Man (SDM / Personel)",
        rootCause: isUnsat
          ? `Ketidaktelitian dalam rekonstitusi kontrol lyophilized (volume pelarut tidak tepat atau akuades tidak terstandar) atau penundaan pembacaan aktivitas kinetik enzim.`
          : `Variasi teknik pemipetan manual reagen awal sebelum masuk ke sistem otomatisasi.`,
        action: isUnsat
          ? `Latih kembali analis terkait rekonstitusi bahan kontrol PME menggunakan mikropipet terkalibrasi dan akuades steril bertemperatur kamar, serta larutkan secara perlahan selama 30 menit.`
          : `Supervisi prosedur penanganan reagen enzimatik dan kepatuhan SOP aklimatisasi kontrol.`,
      },
      {
        category: "MACHINE",
        label: "2. Machine (Alat / Fotometer Kimia)",
        rootCause: isUnsat
          ? `Kerusakan atau degradasi intensitas lampu halogen fotometer, ketidakstabilan pengatur suhu inkubator kuvet (harus presisi 37.0°C ± 0.1°C), atau kuvet tergores/kotor.`
          : `Fluktuasi minor suhu inkubasi kuvet atau sedikit deposit protein pada probe reagen/sampel.`,
        action: isUnsat
          ? `Lakukan kalibrasi suhu inkubasi kuvet (verifikasi 37.0°C), ukur tegangan/intensitas lampu fotometer (ganti bila redup), bersihkan cuvette wash station, dan kalibrasi photometer filter 340 nm.`
          : `Jalankan prosedur pencucian kuvet (cuvette wash) dengan larutan asam/basa pembersih khusus dan periksa nilai blanko kuvet.`,
      },
      {
        category: "METHOD",
        label: "3. Method (Metode Kinetik Enzimatik)",
        rootCause: isUnsat
          ? `Sensitivitas metode kinetik UV (IFCC/DGKC) terganggu oleh substrat depletion (aktivitas enzim sangat tinggi melampaui rentang linearitas absorban Delta-A/min).`
          : `Perbedaan waktu pembacaan absorban (lag phase) pada kurva kinetik reaksi metode ${meth}.`,
        action: isUnsat
          ? `Evaluasi linearitas kurva kinetik Delta-A/min, lakukan pengenceran sampel kontrol bila melampaui linearitas, dan audit parameter lag phase pada software ${inst}.`
          : `Verifikasi kecocokan faktor perkalian (factor k) atau kurva kalibrasi standar enzimatik.`,
      },
      {
        category: "MATERIAL",
        label: "4. Material (Reagen Enzim & Koenzim)",
        rootCause: isUnsat
          ? `Degradasi koenzim NADH/NADPH pada botol reagen cair on-board akibat terpapar suhu panas atau melampaui masa pakai terbuka (open-vial expiration).`
          : `Reagen enzimatik mendekati batas kedaluwarsa atau terjadi sedikit penurunan absorbansi blanko reagen awal.`,
        action: isUnsat
          ? `Ganti reagen enzimatik dengan botol/lot baru, periksa nilai absorban blanko reagen (reagent blank absorbance harus sesuai kit insert), dan buang reagen yang terdegradasi.`
          : `Simpan reagen enzim pada suhu 2–8°C terlindung dari cahaya dan pantau nilai blanko harian.`,
      },
      {
        category: "ENVIRONMENT",
        label: "5. Environment (Lingkungan Lab)",
        rootCause: isUnsat
          ? `Suhu ruangan analitik melebihi 26°C menyebabkan sistem pendingin reagen on-board (reagent carousel cooling) bekerja terlalu berat dan gagal mempertahankan suhu 4–8°C.`
          : `Fluktuasi suhu pendingin udara ruang analitik yang mempengaruhi kestabilan reagen cair terbuka.`,
        action: isUnsat
          ? `Pastikan suhu ruang laboratorium stabil pada rentang 20–22°C dan periksa kipas sirkulasi pendingin kompartemen reagen pada ${inst}.`
          : `Monitor termometer kompartemen reagen secara harian pada logbook pemeliharaan.`,
      },
      {
        category: "MEASUREMENT",
        label: "6. Measurement (Pengukuran & Kalibrasi)",
        rootCause: isUnsat
          ? `Penyimpangan nilai absorban filter panjang gelombang 340 nm atau nilai kalibrator aktivitas enzim bergeser akibat penyimpanan yang tidak tepat.`
          : `Pergeseran nilai faktor kalibrator enzimatik pasca pergantian botol kalibrator baru.`,
        action: isUnsat
          ? `Lakukan kalibrasi ulang penuh menggunakan kalibrator kimia klinis terstandar yang baru dilarutkan, dan jalankan kontrol IQC level normal dan abnormal.`
          : `Evaluasi tren nilai kontrol pada grafik Levey-Jennings untuk mendeteksi deviasi sistematik.`,
      },
    ];
  }

  // 5. Kimia Klinik Substrat & Metabolit (Glukosa, Kolesterol, Asam Urat, Ureum, Kreatinin, dll)
  if (/\b(glukosa|glucose|gds|gdp|kolesterol|cholesterol|trigliserida|triglyceride|asam urat|uric acid|ureum|urea|bun|kreatinin|creatinine|bilirubin total|bilirubin direk|protein total|albumin|hba1c)\b/i.test(pLower)) {
    return [
      {
        category: "MAN",
        label: "1. Man (SDM / Personel)",
        rootCause: isUnsat
          ? `Ketidaktepatan penanganan pra-analitik: rekonstitusi kontrol tidak menggunakan pelarut terukur presisi atau pemipetan spesimen tidak menggunakan tips yang sesuai.`
          : `Variasi waktu kontak reagen dengan sampel antar analis sebelum proses inkubasi analitik.`,
        action: isUnsat
          ? `Lakukan re-evaluasi kompetensi pemipetan analis dan pastikan rekonstitusi vial kontrol PME menggunakan mikropipet terverifikasi serta pelarut standar.`
          : `Sosialisasikan kembali kepatuhan terhadap SOP operasional alat kimia klinik.`,
      },
      {
        category: "MACHINE",
        label: "2. Machine (Alat / Fotometer Kimia)",
        rootCause: isUnsat
          ? `Penurunan intensitas sumber cahaya (lampu fotometer halogen), deposit kotoran pada flow cell / kuvet reaksi, atau carryover pada jarum probe sampel/reagen.`
          : `Fluktuasi minor pada detektor fotometrik atau sedikit goresan pada kuvet reaksi individual.`,
        action: isUnsat
          ? `Lakukan cuvette blank check (ganti kuvet dengan absorban di luar toleransi), bersihkan jarum probe sampel dengan cairan pembersih deproteinasi, dan cek intensitas lampu fotometer.`
          : `Jalankan maintenance mingguan pembersihan sistem optik dan cuvette wash station ${inst}.`,
      },
      {
        category: "METHOD",
        label: "3. Method (Metode Pemeriksaan)",
        rootCause: isUnsat
          ? `Metode pemeriksaan (${meth}) mengalami gangguan interferensi senyawa kromogenik, waktu reaksi endpoint terganggu, atau linearitas kurva terlampaui.`
          : `Karakteristik spesifisitas reagen enzimatik metode ${meth} terhadap matriks bahan kontrol PME.`,
        action: isUnsat
          ? `Verifikasi kurva kalibrasi standar multi-titik, periksa kesesuaian waktu inkubasi, dan pastikan absorban reagen blanko berada dalam batas spesifikasi kit insert.`
          : `Cocokkan batas toleransi hasil laboratorium terhadap konsensus kelompok metode sejenis.`,
      },
      {
        category: "MATERIAL",
        label: "4. Material (Reagen, Kalibrator & Kontrol)",
        rootCause: isUnsat
          ? `Reagen ${param} mengalami oksidasi dini / degradasi warna akibat terpapar udara bebas, kontaminasi reagen, atau vial kontrol PME terkontaminasi bakteri.`
          : `Reagen mendekati tanggal kedaluwarsa atau terjadi sedikit pergeseran nilai antar batch lot reagen.`,
        action: isUnsat
          ? `Ganti reagen dengan botol baru yang masih segar, periksa warna fisik cairan reagen (tidak keruh/berubah warna), dan gunakan kalibrator lot baru.`
          : `Lakukan pencatatan masa pakai reagen on-board dan lakukan cross-check saat pergantian lot baru.`,
      },
      {
        category: "ENVIRONMENT",
        label: "5. Environment (Lingkungan Lab)",
        rootCause: isUnsat
          ? `Suhu ruangan analitik melebihi 25°C atau paparan cahaya lampu/matahari langsung pada reagen kromogenik yang peka cahaya.`
          : `Variasi suhu ruangan laboratorium antara siang dan malam hari yang melebihi rentang kenyamanan instrumen.`,
        action: isUnsat
          ? `Lindungi wadah reagen peka cahaya (gunakan botol gelap/amber), pastikan suhu ruangan 20–22°C stabil 24 jam dengan pendingin AC terkontrol.`
          : `Catat suhu dan kelembaban ruang kimia klinik secara berkala pada lembar kontrol lingkungan.`,
      },
      {
        category: "MEASUREMENT",
        label: "6. Measurement (Pengukuran & Air Sistem)",
        rootCause: isUnsat
          ? `Kualitas air deionisasi / aquabidest pada instrumen menurun (konduktivitas tinggi / ada kontaminasi ion/organik) atau kurva kalibrasi bergeser signifikan.`
          : `Mikropipet dispensing instrumen memerlukan kalibrasi ulang atau filter air deionisasi mendekati jenuh.`,
        action: isUnsat
          ? `Ganti filter sistem deionisasi air (pastikan resistivitas > 10 Megaohm-cm / konduktivitas < 1 uS/cm), lalu jalankan re-kalibrasi penuh.`
          : `Jadwalkan pemeliharaan berkala water purification system laboratorium dan verifikasi kalibrasi volumetrik probe.`,
      },
    ];
  }

  // 6. Elektrolit (Natrium, Kalium, Klorida, Kalsium)
  if (/\b(natrium|na\+|kalium|k\+|klorida|cl\-|kalsium|ca\b|magnesium|mg\b|fosfat|ph\b|pco2|po2)\b/i.test(pLower)) {
    return [
      {
        category: "MAN",
        label: "1. Man (SDM / Personel)",
        rootCause: isUnsat
          ? `Kesalahan teknik penanganan sampel elektrolit: rekonstitusi kontrol dengan akuades yang terkontaminasi ion mineral atau penundaan pemeriksaan sehingga terjadi pertukaran gas/ion.`
          : `Variasi waktu tunggu antara pembukaan vial kontrol dengan waktu aspirasi pada elektroda.`,
        action: isUnsat
          ? `Pastikan pengenceran kontrol menggunakan akuades deionisasi murni terverifikasi bebas ion elektrolit dan periksa sampel segera setelah vial dibuka.`
          : `Sosialisasikan SOP penanganan sampel elektrolit agar tidak terpapar udara terlalu lama.`,
      },
      {
        category: "MACHINE",
        label: "2. Machine (Alat ISE / Elektroda)",
        rootCause: isUnsat
          ? `Protein buildup (lapisan deposit protein) pada membran selektif elektroda ${param}, kehabisan/pengkristalan reference electrode filling solution, atau keausan selang pompa peristaltik ISE.`
          : `Sedikit penurunan sensitivitas membran elektroda ISE (slope elektroda mendekati batas bawah toleransi pabrikan).`,
        action: isUnsat
          ? `Lakukan deproteinisasi membran elektroda (protein remover cleaning), isi ulang/ganti cairan reference solution, bersihkan pin konektor elektroda, dan jalankan slope test.`
          : `Jalankan siklus conditioning membran elektroda secara berkala sesuai manual operasional ${inst}.`,
      },
      {
        category: "METHOD",
        label: "3. Method (Metode Ion Selective Electrode)",
        rootCause: isUnsat
          ? `Metode ISE (${meth}) mengalami gangguan ionic strength akibat rasio pengenceran buffer atau kegagalan kurva two-point calibration.`
          : `Perbedaan prinsip pengukuran antara metode direct ISE dengan indirect ISE terhadap efek matriks protein kontrol PME.`,
        action: isUnsat
          ? `Periksa nilai slope kalibrasi (harus berada dalam rentang toleransi pabrikan mV/decade), dan lakukan kalibrasi multi-point.`
          : `Dokumentasikan jenis teknologi ISE (direct vs indirect) pada laporan evaluasi mutu laboratorium.`,
      },
      {
        category: "MATERIAL",
        label: "4. Material (Reagen Kalibrasi & Cairan Standar)",
        rootCause: isUnsat
          ? `Larutan kalibrator Standard A/B atau reagen buffer ISE terkontaminasi, botol reagen kristalisasi pada lubang aspirasi, atau masa pakai reagen pack habis.`
          : `Reagen kalibrator pack mendekati batas akhir volume (low level volume).`,
        action: isUnsat
          ? `Ganti reagent pack ISE dengan yang baru, bersihkan kristal garam pada jalur fluida, dan lakukan priming menyeluruh.`
          : `Pantau sisa volume reagent pack secara berkala dan pasang pack baru sebelum habis total.`,
      },
      {
        category: "ENVIRONMENT",
        label: "5. Environment (Lingkungan Lab)",
        rootCause: isUnsat
          ? `Gangguan grounding kelistrikan (tegangan netral-ke-ground > 2V) atau induksi medan elektromagnetik yang menyebabkan lonjakan potensial listrik pada elektroda ISE.`
          : `Suhu ruang analitik berfluktuasi melebihi rentang operasional elektroda (20–25°C).`,
        action: isUnsat
          ? `Periksa sistem pentanahan (grounding) kelistrikan laboratorium (harus < 1.0 Ohm), gunakan stabilizer/UPS on-line murni, dan jauhkan dari perangkat bermotor besar.`
          : `Stabilkan suhu pendingin udara ruang analitik secara konsisten.`,
      },
      {
        category: "MEASUREMENT",
        label: "6. Measurement (Pengukuran & Kalibrasi)",
        rootCause: isUnsat
          ? `Nilai slope elektroda ${param} keluar dari batas kalibrasi (drift signifikan mV) sehingga pembacaan tegangan Nernst menghasilkan bias konsentrasi ${zSign}.`
          : `Pergeseran kalibrasi satu titik (one-point calibration drift) antar siklus pemeriksaan.`,
        action: isUnsat
          ? `Lakukan kalibrasi dua titik penuh (full 2-point calibration) dan ganti unit elektroda bila nilai slope tidak dapat pulih setelah dibersihkan.`
          : `Periksa frekuensi auto-calibration pada alat agar berjalan teratur setiap interval yang ditetapkan.`,
      },
    ];
  }

  // 7. Imunoserologi (HBsAg, Anti-HCV, HIV, TSH, CRP, dll)
  if (/\b(hbsag|anti hcv|anti-hcv|hiv|tsh|ft4|ft3|crp|rf|widal|dengue|syphilis|vdrl|tpha)\b/i.test(pLower)) {
    return [
      {
        category: "MAN",
        label: "1. Man (SDM / Personel)",
        rootCause: isUnsat
          ? `Kesalahan teknik pencucian manual/aspirasi, kesalahan volume pemipetan konjugat/sampel, atau waktu inkubasi yang tidak tepat.`
          : `Variasi waktu pemipetan reagen substrat antar sumuran/reaksi.`,
        action: isUnsat
          ? `Lakukan re-training pemipetan mikro terstandar dan pastikan kepatuhan waktu inkubasi serta prosedur pencucian sesuai kit insert.`
          : `Gunakan mikropipet multi-channel terkalibrasi untuk mempercepat dan menyeragamkan pemipetan.`,
      },
      {
        category: "MACHINE",
        label: "2. Machine (Alat / Washer / Reader)",
        rootCause: isUnsat
          ? `Penyumbatan pada dispensing/aspiration pin washer manifold, efisiensi pemisahan magnetik berkurang (CMIA/ECLIA), atau fotodetektor PMT mengalami penurunan sensitivitas.`
          : `Sedikit residu cairan pencuci pada dasar kuvet/sumuran setelah siklus aspirasi terakhir.`,
        action: isUnsat
          ? `Bersihkan aspiration pin washer dengan jarum pembersih khusus, pastikan tekanan vakum cuci optimal, dan kalibrasi sistem optik pembaca.`
          : `Lakukan prime dan purge sistem washer sebelum pengujian dimulai.`,
      },
      {
        category: "METHOD",
        label: "3. Method (Metode Imunokimia)",
        rootCause: isUnsat
          ? `Ketidaksesuaian nilai cutoff (Index/S-CO), interferensi antibodi heterofilik, atau kinetika pengikatan antigen-antibodi terganggu oleh suhu inkubasi.`
          : `Karakteristik batas sensitivitas analitik metode ${meth} terhadap sampel batas (borderline).`,
        action: isUnsat
          ? `Verifikasi nilai cutoff kalibrasi, validasi kurva kalibrasi master, dan audit suhu inkubator reaksi.`
          : `Dokumentasikan nilai Signal-to-Cutoff (S/CO) dan bandingkan dengan kriteria kontrol pabrikan.`,
      },
      {
        category: "MATERIAL",
        label: "4. Material (Reagen, Konjugat & Substrat)",
        rootCause: isUnsat
          ? `Degradasi konjugat antibodi berlabel enzim/luminofor, kontaminasi reagen substrat, atau reagen terpapar suhu di luar 2–8°C saat penyimpanan.`
          : `Reagen mendekati tanggal kedaluwarsa atau terjadi sedikit penurunan intensitas sinyal luminesensi.`,
        action: isUnsat
          ? `Ganti reagen kit dengan lot baru yang terverifikasi, hindari kontaminasi silang tips pipet, dan pastikan rantai dingin penyimpanan terjaga ketat.`
          : `Lakukan pencatatan log stabilitas reagen pasca buka (on-board stability).`,
      },
      {
        category: "ENVIRONMENT",
        label: "5. Environment (Lingkungan Lab)",
        rootCause: isUnsat
          ? `Suhu ruangan analitik berfluktuasi tajam mempengaruhi laju reaksi pembentukan kompleks antigen-antibodi pada tahap inkubasi.`
          : `Kelembaban ruangan analitik yang terlalu rendah atau terlalu tinggi.`,
        action: isUnsat
          ? `Jaga kestabilan suhu ruangan pada 20–22°C dan kelembaban 45–65% di ruang pemeriksaan imunologi.`
          : `Catat termohigrometer ruang analitik secara harian.`,
      },
      {
        category: "MEASUREMENT",
        label: "6. Measurement (Pengukuran & Kalibrasi)",
        rootCause: isUnsat
          ? `Kurva kalibrasi imunoserologi (master curve / 2-point recalibration) tidak valid atau nilai calibrator bergeser melampaui rentang akurasi.`
          : `Sedikit pergeseran nilai sinyal relatif luminescence (RLU) atau optical density (OD).`,
        action: isUnsat
          ? `Jalankan kalibrasi ulang penuh menggunakan kalibrator baru dan evaluasi nilai kontrol negatif serta kontrol positif.`
          : `Monitor konsistensi nilai RLU/absorban kontrol pada grafik Levey-Jennings.`,
      },
    ];
  }

  // 8. Parameter Umum Lainnya (General Fallback dengan diferensiasi tegas Warning vs Unsat)
  return [
    {
      category: "MAN",
      label: "1. Man (SDM / Personel)",
      rootCause: isUnsat
        ? `Penyimpangan signifikan terhadap SOP penanganan spesimen atau rekonstitusi kontrol PME parameter ${param} oleh analis pelaksana, memicu kesalahan analitik berat dengan deviasi ${zSign}.`
        : `Variasi minor teknik pemipetan atau penyiapan sampel kontrol antar petugas analis saat pergantian shift kerja.`,
      action: isUnsat
        ? `Lakukan re-edukasi dan evaluasi kompetensi menyeluruh terhadap analis pelaksana, terbitkan instruksi kerja terstandar, dan supervisi langsung proses pengujian ulang.`
        : `Sosialisasikan kembali SOP teknis parameter ${param} dan lakukan pemantauan kepatuhan kerja rutin.`,
    },
    {
      category: "MACHINE",
      label: "2. Machine (Alat / Instrumen)",
      rootCause: isUnsat
        ? `Kegagalan hardware kritis pada detektor/sensor utama instrumen ${inst}, sumbatan probe aspirator, atau drift kalibrasi berat pada channel analit ${param}.`
        : `Pergeseran (drift) minor pada komponen optik/mekanik instrumen ${inst} yang terakumulasi selama jam operasional tinggi.`,
      action: isUnsat
        ? `Lakukan pemeliharaan korektif mendalam (deep cleaning probe & optical cell), servis teknis bila diperlukan, dan kalibrasi ulang penuh sebelum instrumen digunakan kembali.`
        : `Jalankan siklus autowash harian, periksa kestabilan baseline instrumen, dan lakukan verifikasi presisi.`,
    },
    {
      category: "METHOD",
      label: "3. Method (Metode Pemeriksaan)",
      rootCause: isUnsat
        ? `Prinsip metode ${meth} mengalami gangguan interferensi substansi matriks berat atau batas linearitas deteksi analitik terlampaui.`
        : `Karakteristik kinerja metode ${meth} menunjukkan sedikit pergeseran sensitivitas terhadap konsensus kelompok sejenis.`,
      action: isUnsat
        ? `Validasi ulang kurva kalibrasi multi-titik, verifikasi rentang linearitas metode ${meth}, dan pastikan kepatuhan ketat pada kit insert resmi pabrikan.`
        : `Dokumentasikan evaluasi metode dan pantau tren hasil kontrol pada grafik kontrol mutu.`,
    },
    {
      category: "MATERIAL",
      label: "4. Material (Reagen & Kontrol)",
      rootCause: isUnsat
        ? `Reagen ${param} mengalami degradasi parah, kontaminasi, atau vial kontrol PME rusak akibat penyimpanan di luar rantai dingin (cold chain 2–8°C).`
        : `Reagen mendekati batas akhir masa simpan (expiry date) atau terjadi variasi minor antar lot reagen baru.`,
      action: isUnsat
        ? `Ganti botol reagen dengan lot baru yang terverifikasi, buang reagen yang dicurigai rusak, dan gunakan vial kontrol baru yang tersegel rapi.`
        : `Terapkan sistem FIFO pada penyimpanan reagen dan verifikasi lot baru sebelum digunakan untuk pasien.`,
    },
    {
      category: "ENVIRONMENT",
      label: "5. Environment (Lingkungan Lab)",
      rootCause: isUnsat
        ? `Suhu dan kelembaban ruang laboratorium berfluktuasi tajam di luar rentang batas toleransi kerja alat (18–25°C), mengacaukan kinetika analitik.`
        : `Variasi suhu ruangan laboratorium yang mendekati batas toleransi atas saat beban pemeriksaan tinggi.`,
      action: isUnsat
        ? `Stabilkan pendingin udara (AC) ruangan laboratorium 24 jam dan pastikan sirkulasi udara di sekitar instrumen ${inst} tidak terhalang.`
        : `Catat suhu dan kelembaban secara rutin pada logbook monitoring lingkungan laboratorium.`,
    },
    {
      category: "MEASUREMENT",
      label: "6. Measurement (Pengukuran & Kalibrasi)",
      rootCause: isUnsat
        ? `Kurva kalibrasi parameter ${param} telah kadaluwarsa/bergeser signifikan atau nilai kalibrator pabrikan mengalami bias sistemik.`
        : `Sedikit pergeseran nilai kalibrasi yang terdeteksi pada tren kontrol mutu internal harian.`,
      action: isUnsat
        ? `Lakukan kalibrasi ulang resmi menggunakan kalibrator baru yang tertelusur (traceable), dan evaluasi aturan Westgard pada grafik Levey-Jennings.`
        : `Pantau nilai bias dan %CV harian untuk memastikan deviasi tidak berkembang menjadi tidak memuaskan.`,
    },
  ];
}

/* ========================================================================== */
/*                      KOP SURAT & HEADER RESMI MULTI-TENANT                */
/* ========================================================================== */

interface KopSuratInfo {
  logoKiri?: string | null;
  logoKanan?: string | null;
  pemda?: string | null;
  namaRumahSakit?: string | null;
  alamatRumahSakit?: string | null;
  kontakRumahSakit?: string | null;
}

function drawOfficialPdfKopSurat(
  doc: jsPDF,
  kop: KopSuratInfo | null | undefined,
  defaultLabName: string,
  options?: {
    startY?: number;
    showDivider?: boolean;
    compact?: boolean;
  }
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const startY = options?.startY ?? 8;
  const logoSize = options?.compact ? 14 : 17;
  const kopY = startY;

  // 1. Logo Kiri
  if (kop?.logoKiri) {
    try {
      doc.addImage(kop.logoKiri, "PNG", margin, kopY, logoSize, logoSize);
    } catch {}
  }

  // 2. Logo Kanan
  if (kop?.logoKanan) {
    try {
      doc.addImage(kop.logoKanan, "PNG", pageW - margin - logoSize, kopY, logoSize, logoSize);
    } catch {}
  }

  // 3. Teks Identitas Kop Surat (Tengah)
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(options?.compact ? 8 : 9);
  doc.text(
    (kop?.pemda || "PEMERINTAH DAERAH / DINAS KESEHATAN").toUpperCase(),
    pageW / 2,
    kopY + (options?.compact ? 3.5 : 4),
    { align: "center" }
  );

  doc.setFontSize(options?.compact ? 10.5 : 12);
  doc.text(
    (kop?.namaRumahSakit || defaultLabName || "RUMAH SAKIT / LABORATORIUM KLINIK").toUpperCase(),
    pageW / 2,
    kopY + (options?.compact ? 8 : 9.5),
    { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(options?.compact ? 7 : 8);
  doc.text(
    kop?.alamatRumahSakit || "Alamat Lengkap Rumah Sakit / Laboratorium Klinik",
    pageW / 2,
    kopY + (options?.compact ? 11.5 : 14),
    { align: "center" }
  );

  doc.setFontSize(options?.compact ? 6.5 : 7.5);
  doc.text(
    kop?.kontakRumahSakit || "Telepon, Fax & Email Resmi Laboratorium",
    pageW / 2,
    kopY + (options?.compact ? 14.5 : 18),
    { align: "center" }
  );

  const dividerY = kopY + (options?.compact ? 17.5 : 21.5);

  // 4. Double divider line (Format resmi instansi / rumah sakit)
  if (options?.showDivider !== false) {
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.6);
    doc.line(margin, dividerY, pageW - margin, dividerY);
    doc.setLineWidth(0.2);
    doc.line(margin, dividerY + 0.8, pageW - margin, dividerY + 0.8);
  }

  return dividerY + 2;
}

/* ========================================================================== */
/*                           PDF MODEL 1 (KOMPREHENSIF)                       */
/* ========================================================================== */

export async function generatePdfReport(sessionId: string, organizationId: string): Promise<Buffer> {
  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, ...(organizationId === "ALL" ? {} : { organizationId }) },
    include: {
      file: true,
      results: { include: { aiAnalysis: true }, orderBy: { parameterName: "asc" } },
      organization: {
        include: {
          kopSurat: true,
        },
      },
    },
  });
  if (!session) throw new Error("Sesi PME tidak ditemukan");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();

  /* ---------- KOP SURAT RESMI ---------- */
  const kopData = session.organization?.kopSurat;
  const labName = session.laboratoryName || session.organization?.name || "Laboratorium Peserta";
  const endKopY = drawOfficialPdfKopSurat(doc, kopData, labName, { startY: 8, showDivider: true });

  /* ---------- COVER BANNER ---------- */
  let y = endKopY + 3;
  doc.setFillColor(13, 122, 105);
  doc.roundedRect(12, y, pageW - 24, 20, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("LAPORAN ANALISIS PME & RENCANA MUTU", pageW / 2, y + 7.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Pemantapan Mutu Eksternal (External Quality Assessment) — Evaluasi Terstandar", pageW / 2, y + 13, { align: "center" });
  doc.setFontSize(7.5);
  doc.text(`Waktu Cetak: ${new Date().toLocaleString("id-ID")}`, pageW / 2, y + 17.5, { align: "center" });

  doc.setTextColor(30, 30, 30);
  y += 26;

  /* ---------- IDENTITAS PME ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. Identitas Dokumen & Laboratorium", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Parameter Dokumen", "Nilai / Keterangan"]],
    body: [
      ["Laboratorium", session.laboratoryName || session.organization?.name || "-"],
      ["Penyelenggara (Provider)", session.provider || "-"],
      ["Program PME", session.program || "-"],
      ["Siklus / Periode", `${session.cycle || "-"} / ${session.period || "-"}`],
      ["Nomor Peserta (ID)", session.participantId || "-"],
      ["Nama Berkas PDF", session.file?.fileName || "-"],
      ["Versi Aturan Z-Score", session.ruleVersion || "v1.0-default"],
      ["Metode Validasi", "Standar ISO 13528 & Permenkes"],
    ],
    headStyles: { fillColor: [13, 122, 105], fontSize: 9 },
    styles: { fontSize: 8.5 },
  });
  // @ts-expect-error lastAutoTable injected
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  /* ---------- EXECUTIVE SUMMARY ---------- */
  const results = session.results;
  const counts = {
    satisfactory: results.filter((r) => r.zStatus === "SATISFACTORY").length,
    warning: results.filter((r) => r.zStatus === "WARNING").length,
    unsatisfactory: results.filter((r) => r.zStatus === "UNSATISFACTORY").length,
    review: results.filter((r) => r.validationStatus === "REVIEW_REQUIRED").length,
  };
  doc.setFontSize(13);
  doc.text("2. Ringkasan Eksekutif Kinerja Mutu", 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(
    `Dari total ${results.length} parameter pemeriksaan yang dievaluasi: ${counts.satisfactory} dinyatakan Memuaskan (|Z| <= 2), ${counts.warning} Waspada (2 < |Z| < 3), ${counts.unsatisfactory} Tidak Memuaskan (|Z| >= 3), dan ${counts.review} memerlukan telaah teknis.`,
    14,
    y,
    { maxWidth: pageW - 28 }
  );
  y += 10;

  /* ---------- RESULT TABLE (Ringkasan Z-Score Multi-Kelompok) ---------- */
  doc.setFontSize(13);
  doc.text("3. Rekapitulasi Hasil Numerik Z-Score", 14, y);
  y += 4;

  const rowLevels = results.map((r) => getRowEvaluationLevel(r));

  autoTable(doc, {
    startY: y,
    theme: "grid",
    tableWidth: 186,
    margin: { left: 12, right: 12 },
    head: [
      [
        { content: "No", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Parameter", rowSpan: 2, styles: { halign: "left", valign: "middle" } },
        { content: "Hasil Lab", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Kelompok Alat", colSpan: 2, styles: { halign: "center" } },
        { content: "Kelompok Metode", colSpan: 2, styles: { halign: "center" } },
        { content: "Seluruh Peserta", colSpan: 2, styles: { halign: "center" } },
        { content: "Status Mutu", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
      ],
    ],
    body: results.map((r, idx) => {
      // Kelompok Alat
      const isInstNotAnalyzed =
        r.instrumentStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.instrumentZScore === null && r.instrumentTarget === null);
      const instTarget = !isInstNotAnalyzed && r.instrumentTarget !== null && r.instrumentTarget !== undefined
        ? fmt(r.instrumentTarget, 2)
        : "-";
      const instZ = !isInstNotAnalyzed && r.instrumentZScore !== null && r.instrumentZScore !== undefined
        ? fmtZ(r.instrumentZScore)
        : "-";

      // Kelompok Metode
      const isMethNotAnalyzed =
        r.methodStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.methodZScore === null && r.methodTarget === null);
      const methTarget = !isMethNotAnalyzed && r.methodTarget !== null && r.methodTarget !== undefined
        ? fmt(r.methodTarget, 2)
        : "-";
      const methZ = !isMethNotAnalyzed && r.methodZScore !== null && r.methodZScore !== undefined
        ? fmtZ(r.methodZScore)
        : "-";

      // Seluruh Peserta
      const isAllNotAnalyzed =
        r.allParticipantsStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.allParticipantsZScore === null && r.allParticipantsTarget === null && r.zScore === null && r.targetValue === null);
      const allTarget = !isAllNotAnalyzed && (r.allParticipantsTarget !== null && r.allParticipantsTarget !== undefined
        ? fmt(r.allParticipantsTarget, 2)
        : (r.targetValue !== null ? fmt(r.targetValue, 2) : "-"));
      const allZ = !isAllNotAnalyzed && (r.allParticipantsZScore !== null && r.allParticipantsZScore !== undefined
        ? fmtZ(r.allParticipantsZScore)
        : (r.zScore !== null ? fmtZ(r.zScore) : "-"));

      const labVal =
        r.participantValue !== null && r.participantValue !== undefined
          ? `${fmt(r.participantValue, 2)}${r.unit ? ` ${r.unit}` : ""}`.trim()
          : "-";

      const statusText = getOverallStatusLabel(r);

      return [
        String(idx + 1),
        r.parameterName,
        labVal,
        instTarget,
        instZ,
        methTarget,
        methZ,
        allTarget,
        allZ,
        statusText,
      ];
    }),
    headStyles: {
      fillColor: [13, 122, 105],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineColor: [255, 255, 255],
      lineWidth: 0.1,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 36, halign: "left" },
      2: { cellWidth: 19, halign: "center" },
      3: { cellWidth: 17, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 17, halign: "center" },
      6: { cellWidth: 16, halign: "center" },
      7: { cellWidth: 17, halign: "center" },
      8: { cellWidth: 16, halign: "center" },
      9: { cellWidth: 25, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const level = rowLevels[data.row.index];
        if (level === "UNSATISFACTORY") {
          data.cell.styles.fillColor = [254, 226, 226]; // Merah pastel (#FEE2E2)
          data.cell.styles.textColor = [153, 27, 27];   // Teks merah gelap (#991B1B)
          if (data.column.index === 9 || data.column.index === 1) {
            data.cell.styles.fontStyle = "bold";
          }
        } else if (level === "WARNING") {
          data.cell.styles.fillColor = [254, 243, 199]; // Kuning pastel (#FEF3C7)
          data.cell.styles.textColor = [146, 64, 14];   // Teks kuning gelap / amber (#92400E)
          if (data.column.index === 9 || data.column.index === 1) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
  });

  /* ---------- TABEL KOMPREHENSIF Z-SCORE DENGAN KOLOM EVALUASI LENGKAP ---------- */
  // Disajikan dalam halaman baru berorientasi LANDSCAPE agar seluruh kolom terbaca jelas
  doc.addPage("a4", "landscape");
  const landW = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 122, 105);
  doc.rect(0, 0, landW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("4. Evaluasi Mendalam Hasil Z-Score & Rencana Tindakan Mutu", 14, 13);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.text(
    "Tabel di bawah menyajikan rincian setiap parameter yang memiliki nilai Z-Score mencakup Interpretasi Klinis, Kemungkinan Akar Masalah, Investigasi, Tindakan Perbaikan, dan Tindakan Pencegahan.",
    14,
    27
  );

  const zResults = results.filter((r) => getRowEvaluationLevel(r) !== "NOT_ANALYZED");
  const table4Levels = zResults.map((r) => getRowEvaluationLevel(r));

  autoTable(doc, {
    startY: 32,
    theme: "grid",
    tableWidth: 269,
    margin: { left: 14, right: 14 },
    head: [[
      "Parameter & Z-Score",
      "Interpretasi Klinis & Analisis Bias",
      "Kemungkinan Penyebab",
      "Langkah Investigasi",
      "Tindakan Perbaikan (Korektif)",
      "Tindakan Pencegahan"
    ]],
    body: zResults.map((r) => {
      const a = r.aiAnalysis;
      const zGlobal = r.allParticipantsZScore ?? r.zScore;
      const zMethod = r.methodZScore;
      const zInst = r.instrumentZScore;

      let zDetails = `Z-Global: ${fmtZ(zGlobal)}`;
      zDetails += `\nZ-Metode: ${fmtZ(zMethod)}`;
      zDetails += `\nZ-Alat: ${fmtZ(zInst)}`;

      const statusText = getOverallStatusLabel(r);
      const paramCol = `${r.parameterName}\n${zDetails}\nStatus: ${statusText}`;

      let interp = a?.interpretation
        ? a.interpretation
        : (r.zStatus === "SATISFACTORY"
            ? "Hasil dalam batas toleransi analitik (memuaskan). Performa pengujian stabil."
            : "Memerlukan investigasi lebih lanjut terkait deviasi analitik.");

      if (a?.biasAnalysis) {
        interp += `\n\n[Analisis Bias Analitik]:\n${a.biasAnalysis}`;
      }

      const causes = a?.possibleCauses ? formatList(safeParseArray(a.possibleCauses)) : "- Menjaga kestabilan reagen & instrumen";
      const invest = a?.investigationSteps ? formatList(safeParseArray(a.investigationSteps)) : "- Evaluasi tren IQC harian";
      const corrective = a?.correctiveActions ? formatList(safeParseArray(a.correctiveActions)) : "- Lakukan kalibrasi ulang bila IQC bergeser";
      const preventive = a?.preventiveActions ? formatList(safeParseArray(a.preventiveActions)) : "- Pemeliharaan rutin instrumen & cek suhu reagen";

      return [paramCol, interp, causes, invest, corrective, preventive];
    }),
    headStyles: { fillColor: [13, 122, 105], fontSize: 8, fontStyle: "bold", halign: "center" },
    styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 49 },
      2: { cellWidth: 46 },
      3: { cellWidth: 44 },
      4: { cellWidth: 46 },
      5: { cellWidth: 46 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const level = table4Levels[data.row.index];
        if (level === "UNSATISFACTORY") {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
        } else if (level === "WARNING") {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        }
      }
    },
  });

  /* ---------- 5. ANALISIS AKAR MASALAH & PROBLEM SOLVING METODE FISHBONE (DIAGRAM ISHIKAWA 6M) ---------- */
  const fishboneCandidates = results.filter((r) => {
    const level = getRowEvaluationLevel(r);
    return level === "UNSATISFACTORY" || level === "WARNING";
  });

  doc.addPage("a4", "landscape");
  const fbLandW = doc.internal.pageSize.getWidth();
  const fbLandH = doc.internal.pageSize.getHeight();

  doc.setFillColor(13, 122, 105);
  doc.rect(0, 0, fbLandW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("5. Analisis Problem Solving Metode Fishbone (Diagram Ishikawa 6M)", 14, 13);

  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    "Analisis akar masalah terstruktur (Metode Fishbone Ishikawa 6M: Man, Machine, Method, Material, Environment, Measurement) khusus untuk parameter dengan evaluasi Peringatan (Warning) dan Tidak Memuaskan (Unsatisfactory) sesuai standar manajemen mutu laboratorium ISO 15189.",
    14,
    27
  );

  let fbY = 32;

  if (fishboneCandidates.length === 0) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, fbY, fbLandW - 28, 24, 2, 2, "FD");
    doc.setTextColor(4, 120, 87);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("STATUS MUTU PRIMA: SELURUH PARAMETER PENGUJIAN MEMUASKAN", 20, fbY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text(
      "Seluruh parameter pada siklus evaluasi PME ini memenuhi kriteria memuaskan (|Z| ≤ 2.0). Tidak ditemukan deviasi analitik yang memerlukan analisis akar masalah Fishbone.",
      20,
      fbY + 17
    );
  } else {
    for (let fIdx = 0; fIdx < fishboneCandidates.length; fIdx++) {
      const r = fishboneCandidates[fIdx];
      const level = getRowEvaluationLevel(r);
      const isUnsat = level === "UNSATISFACTORY";
      const statusLabel = isUnsat ? "TIDAK MEMUASKAN (UNSATISFACTORY)" : "PERINGATAN (WARNING)";
      const zGlobal = r.allParticipantsZScore ?? r.zScore;
      const zInst = r.instrumentZScore;
      const zMethod = r.methodZScore;
      const fbItems = resolveFishboneAnalysis(r);

      // Check remaining space on current page, if less than 65mm add new landscape page
      if (fbY + 65 > fbLandH - 15) {
        doc.addPage("a4", "landscape");
        fbY = 16;
      }

      // Parameter banner
      doc.setFillColor(isUnsat ? 254 : 254, isUnsat ? 242 : 243, isUnsat ? 242 : 199);
      doc.setDrawColor(isUnsat ? 239 : 245, isUnsat ? 68 : 158, isUnsat ? 68 : 11);
      doc.roundedRect(14, fbY, fbLandW - 28, 8, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(isUnsat ? 185 : 180, isUnsat ? 28 : 83, isUnsat ? 28 : 9);
      const bannerText = `Parameter: ${r.parameterName}  |  Status: ${statusLabel}  |  Z-Global: ${fmtZ(zGlobal)}  |  Z-Alat: ${fmtZ(zInst)}  |  Z-Metode: ${fmtZ(zMethod)}  |  Metode: ${r.method || "-"}  |  Alat: ${r.instrument || "-"}`;
      doc.text(bannerText, 18, fbY + 5.5);

      fbY += 10;

      autoTable(doc, {
        startY: fbY,
        theme: "grid",
        tableWidth: 269,
        margin: { left: 14, right: 14 },
        head: [["Kategori 6M (Fishbone Bone)", "Identifikasi Akar Masalah (Root Cause)", "Rencana Tindakan Problem Solving (Action Plan)"]],
        body: fbItems.map((it: any) => [
          it.label || it.category,
          it.rootCause || "-",
          it.action || "-",
        ]),
        headStyles: {
          fillColor: isUnsat ? [185, 28, 28] : [180, 83, 9],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "center",
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: "linebreak",
          valign: "top",
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: "bold" },
          1: { cellWidth: 105 },
          2: { cellWidth: 114 },
        },
      });

      // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
      fbY = (doc.lastAutoTable?.finalY ?? fbY + 42) + 7;
    }
  }

  /* ---------- 6. KESIMPULAN & TANDA TANGAN (Portrait Page) ---------- */
  doc.addPage("a4", "portrait");
  y = 25;
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text("6. Kesimpulan & Rekomendasi Mutu", 14, y);
  y += 6;
  doc.setFontSize(9.5);
  const conclusion =
    counts.unsatisfactory > 0
      ? `Terdapat ${counts.unsatisfactory} parameter Tidak Memuaskan dan ${counts.warning} parameter Waspada yang memerlukan verifikasi berkas CAPA segera, audit reagen, serta kalibrasi instrumen sebelum siklus PME selanjutnya.`
      : counts.warning > 0
        ? `Terdapat ${counts.warning} parameter Waspada. Dianjurkan melakukan monitoring ketat pada grafik Levey-Jennings kontrol kualitas internal harian.`
        : "Seluruh parameter pengujian dinyatakan memuaskan dan memenuhi standar akurasi serta presisi laboratorium.";

  y = wrapText(doc, conclusion, 14, y, pageW - 28) + 15;

  doc.setFontSize(10);
  doc.text("Dibuat Oleh (Penanggung Jawab Mutu):", 14, y);
  doc.text("Disetujui Oleh (Kepala Laboratorium):", pageW - 80, y);
  doc.line(14, y + 25, 70, y + 25);
  doc.line(pageW - 80, y + 25, pageW - 14, y + 25);
  doc.setFontSize(8.5);
  doc.text("Analis QA / Koordinator Mutu", 14, y + 30);
  doc.text(session.laboratoryName || "Kepala Laboratorium", pageW - 80, y + 30);

  return Buffer.from(doc.output("arraybuffer"));
}

/* ========================================================================== */
/*              PDF MODEL 2 (FORMAT EVALUASI SASARAN / MUTU 5 KOLOM)          */
/* ========================================================================== */

export async function generatePdfReportModel2(sessionId: string, organizationId: string): Promise<Buffer> {
  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, ...(organizationId === "ALL" ? {} : { organizationId }) },
    include: {
      file: true,
      results: { include: { aiAnalysis: true, capaActions: true }, orderBy: { parameterName: "asc" } },
      organization: {
        include: {
          kopSurat: true,
        },
      },
    },
  });
  if (!session) throw new Error("Sesi PME tidak ditemukan");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();

  /* ---------- KOP SURAT RESMI ---------- */
  const kopData = session.organization?.kopSurat;
  const labName = session.laboratoryName || session.organization?.name || "Laboratorium Peserta";
  const endKopY = drawOfficialPdfKopSurat(doc, kopData, labName, { startY: 7, showDivider: true });

  /* ---------- DOCUMENT BANNER / TITLE ---------- */
  let y = endKopY + 2.5;
  doc.setFillColor(13, 122, 105);
  doc.roundedRect(14, y, pageW - 28, 14, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text("FORMULIR EVALUASI DAN HASIL REKAPITULASI PEMANTAPAN MUTU EKSTERNAL (MODEL 2)", pageW / 2, y + 5.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `Laboratorium: ${labName} | Program: ${session.program || "Kimia Klinik"} | Siklus: ${session.cycle || "-"} | Periode: ${session.period || "-"} | Waktu Cetak: ${new Date().toLocaleString("id-ID")}`,
    pageW / 2,
    y + 10.5,
    { align: "center" }
  );

  doc.setTextColor(30, 30, 30);
  y += 18;

  /* Section 1: Rekapitulasi Hasil Numerik Z-Score */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("1. Rekapitulasi Hasil Numerik Z-Score (Kelompok Alat, Metode & Seluruh Peserta)", 14, y);
  y += 3;

  const rowLevels = session.results.map((r) => getRowEvaluationLevel(r));

  autoTable(doc, {
    startY: y,
    theme: "grid",
    tableWidth: 257,
    margin: { left: 20, right: 20 },
    head: [
      [
        { content: "No", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Parameter", rowSpan: 2, styles: { halign: "left", valign: "middle" } },
        { content: "Hasil Lab", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Kelompok Alat", colSpan: 2, styles: { halign: "center" } },
        { content: "Kelompok Metode", colSpan: 2, styles: { halign: "center" } },
        { content: "Seluruh Peserta", colSpan: 2, styles: { halign: "center" } },
        { content: "Status Mutu", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
      ],
    ],
    body: session.results.map((r, idx) => {
      const isInstNotAnalyzed =
        r.instrumentStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.instrumentZScore === null && r.instrumentTarget === null);
      const instTarget = !isInstNotAnalyzed && r.instrumentTarget !== null && r.instrumentTarget !== undefined
        ? fmt(r.instrumentTarget, 2)
        : "-";
      const instZ = !isInstNotAnalyzed && r.instrumentZScore !== null && r.instrumentZScore !== undefined
        ? fmtZ(r.instrumentZScore)
        : "-";

      const isMethNotAnalyzed =
        r.methodStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.methodZScore === null && r.methodTarget === null);
      const methTarget = !isMethNotAnalyzed && r.methodTarget !== null && r.methodTarget !== undefined
        ? fmt(r.methodTarget, 2)
        : "-";
      const methZ = !isMethNotAnalyzed && r.methodZScore !== null && r.methodZScore !== undefined
        ? fmtZ(r.methodZScore)
        : "-";

      const isAllNotAnalyzed =
        r.allParticipantsStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.allParticipantsZScore === null && r.allParticipantsTarget === null && r.zScore === null && r.targetValue === null);
      const allTarget = !isAllNotAnalyzed && (r.allParticipantsTarget !== null && r.allParticipantsTarget !== undefined
        ? fmt(r.allParticipantsTarget, 2)
        : (r.targetValue !== null ? fmt(r.targetValue, 2) : "-"));
      const allZ = !isAllNotAnalyzed && (r.allParticipantsZScore !== null && r.allParticipantsZScore !== undefined
        ? fmtZ(r.allParticipantsZScore)
        : (r.zScore !== null ? fmtZ(r.zScore) : "-"));

      const labVal =
        r.participantValue !== null && r.participantValue !== undefined
          ? `${fmt(r.participantValue, 2)}${r.unit ? ` ${r.unit}` : ""}`.trim()
          : "-";

      const statusText = getOverallStatusLabel(r);

      return [
        String(idx + 1),
        r.parameterName,
        labVal,
        instTarget,
        instZ,
        methTarget,
        methZ,
        allTarget,
        allZ,
        statusText,
      ];
    }),
    headStyles: {
      fillColor: [13, 122, 105],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineColor: [255, 255, 255],
      lineWidth: 0.1,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 45, halign: "left" },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 24, halign: "center" },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 24, halign: "center" },
      6: { cellWidth: 24, halign: "center" },
      7: { cellWidth: 24, halign: "center" },
      8: { cellWidth: 24, halign: "center" },
      9: { cellWidth: 33, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const level = rowLevels[data.row.index];
        if (level === "UNSATISFACTORY") {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
          if (data.column.index === 9 || data.column.index === 1) {
            data.cell.styles.fontStyle = "bold";
          }
        } else if (level === "WARNING") {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
          if (data.column.index === 9 || data.column.index === 1) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
  });

  /* Section 2: Formulir Evaluasi Sasaran Mutu 5 Kolom (Halaman Baru) */
  doc.addPage("a4", "landscape");
  const endKopY2 = drawOfficialPdfKopSurat(doc, kopData, labName, { startY: 7, showDivider: true, compact: true });
  let y2 = endKopY2 + 2;
  doc.setFillColor(13, 122, 105);
  doc.roundedRect(14, y2, pageW - 28, 9, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("2. Formulir Evaluasi Sasaran Mutu & Rencana Tindak Lanjut", 18, y2 + 6);

  doc.setTextColor(30, 30, 30);
  y2 += 12;

  /* 5 Columns matching EVALUASI PME.xlsx: No, Sasaran, Hasil Pencapain, Rencana Perbaikan, Penanggung Jawab */
  const bodyRows = session.results.map((r, idx) => {
    const a = r.aiAnalysis;
    const isAnalyzed = getRowEvaluationLevel(r) !== "NOT_ANALYZED";
    const zStr = isAnalyzed && r.zScore !== null ? (r.zScore > 0 ? `+${fmt(r.zScore, 2)}` : fmt(r.zScore, 2)) : "-";
    const statusStr = isAnalyzed ? (STATUS_LABEL[r.zStatus || ""] || "Perlu Review") : "-";

    const sasaran = `Pemeriksaan ${r.parameterName}\n(Metode: ${r.method || "Standard"}, Alat: ${r.instrument || "Auto Analyzer"})`;
    const pencapaian = isAnalyzed
      ? `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nNilai Target: ${r.targetValue ?? "-"}\nSDPA: ${r.sdpa ?? "-"}\nZ-Score: ${zStr} (${statusStr})`
      : `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nNilai Target: -\nSDPA: -\nZ-Score: - (-)`;

    let perbaikan = "";
    if (!isAnalyzed) {
      perbaikan = "-";
    } else if (a?.correctiveActions) {
      const corrective = safeParseArray(a.correctiveActions);
      const preventive = safeParseArray(a.preventiveActions);
      const cLines = corrective.slice(0, 2).map((c) => `• ${c}`).join("\n");
      const pLines = preventive.slice(0, 2).map((p) => `• ${p}`).join("\n");
      perbaikan = [cLines, pLines ? `Pencegahan:\n${pLines}` : ""].filter(Boolean).join("\n\n");
    } else if (r.zStatus === "SATISFACTORY") {
      perbaikan = "Pertahankan performa pengujian dengan pemeliharaan instrumen rutin dan kontrol harian (IQC).";
    } else {
      perbaikan = "Lakukan evaluasi presisi dan akurasi instrumen serta pengujian ulang bahan kontrol.";
    }

    const pic = r.capaActions?.[0]?.pic || "Analis QA / Ka Lab";

    return [String(idx + 1), sasaran, pencapaian, perbaikan, pic];
  });

  autoTable(doc, {
    startY: y2,
    theme: "grid",
    head: [["No.", "Sasaran", "Hasil Pencapain", "Rencana Perbaikan", "Penanggung Jawab"]],
    body: bodyRows,
    headStyles: {
      fillColor: [13, 122, 105],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    margin: { left: 14, right: 14 },
    tableWidth: 268,
    columnStyles: {
      0: { cellWidth: 11, halign: "center" },
      1: { cellWidth: 62 },
      2: { cellWidth: 64 },
      3: { cellWidth: 95 },
      4: { cellWidth: 36, halign: "center" },
    },
  });

  // Signature Block at Bottom of Model 2
  // @ts-expect-error lastAutoTable injected
  const lastY2 = doc.lastAutoTable?.finalY ?? 150;
  const pageH2 = doc.internal.pageSize.getHeight();
  let signY2 = lastY2 + 10;
  if (signY2 + 25 > pageH2 - 14) {
    doc.addPage("a4", "landscape");
    signY2 = 25;
  }
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text("Dianalisis & Dibuat Oleh:", 20, signY2);
  doc.text("( Petugas Penjamin Mutu Laboratorium )", 20, signY2 + 18);
  doc.text("Disetujui & Diverifikasi Oleh:", pageW - 80, signY2);
  doc.text(`( ${labName || "Penanggung Jawab Teknis Mutu"} )`, pageW - 80, signY2 + 18);

  return Buffer.from(doc.output("arraybuffer"));
}

/* ========================================================================== */
/*                             EXCEL MODEL 1 (TEKNIS)                         */
/* ========================================================================== */

export async function generateExcelReport(sessionId: string, organizationId: string): Promise<Buffer> {
  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, ...(organizationId === "ALL" ? {} : { organizationId }) },
    include: {
      file: true,
      results: { include: { aiAnalysis: true }, orderBy: { parameterName: "asc" } },
      organization: true,
    },
  });
  if (!session) throw new Error("Sesi PME tidak ditemukan");

  const wb = new ExcelJS.Workbook();
  wb.creator = "didikpme - Evaluasi Mutu PME";
  wb.created = new Date();

  const ws = wb.addWorksheet("Hasil PME Teknis");
  ws.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Parameter", key: "parameter", width: 25 },
    { header: "Hasil Lab (Peserta)", key: "participant", width: 20 },
    { header: "Satuan", key: "unit", width: 12 },
    { header: "Metode", key: "method", width: 16 },
    { header: "Alat / Instrumen", key: "instrument", width: 20 },
    // Rekapitulasi Kelompok Alat
    { header: "Target (Kel. Alat)", key: "instrumentTarget", width: 18 },
    { header: "SDPA (Kel. Alat)", key: "instrumentSdpa", width: 16 },
    { header: "Z-Score (Kel. Alat)", key: "instrumentZScore", width: 18 },
    { header: "Status (Kel. Alat)", key: "instrumentStatus", width: 18 },
    // Rekapitulasi Kelompok Metode
    { header: "Target (Kel. Metode)", key: "methodTarget", width: 18 },
    { header: "SDPA (Kel. Metode)", key: "methodSdpa", width: 16 },
    { header: "Z-Score (Kel. Metode)", key: "methodZScore", width: 18 },
    { header: "Status (Kel. Metode)", key: "methodStatus", width: 18 },
    // Rekapitulasi Seluruh Peserta
    { header: "Target (Seluruh Peserta)", key: "allParticipantsTarget", width: 22 },
    { header: "SDPA (Seluruh Peserta)", key: "allParticipantsSdpa", width: 20 },
    { header: "Z-Score (Seluruh Peserta)", key: "allParticipantsZScore", width: 22 },
    { header: "Status (Seluruh Peserta)", key: "allParticipantsStatus", width: 20 },
    // Status Mutu Keseluruhan
    { header: "Status Mutu Keseluruhan", key: "status", width: 22 },
    // Analisis Multi-Kelompok & Evaluasi
    { header: "Evaluasi Kelompok Alat", key: "instrumentEvaluation", width: 35 },
    { header: "Evaluasi Kelompok Metode", key: "methodEvaluation", width: 35 },
    { header: "Analisis Bias Analitik", key: "biasAnalysis", width: 40 },
    { header: "Interpretasi Klinis", key: "interpretation", width: 45 },
    { header: "Kemungkinan Penyebab", key: "cause", width: 40 },
    { header: "Langkah Investigasi", key: "investigation", width: 40 },
    { header: "Tindakan Korektif", key: "corrective", width: 40 },
    { header: "Tindakan Preventif", key: "preventive", width: 40 },
  ];

  ws.getRow(1).height = 28;
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D7A69" } };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  for (let idx = 0; idx < session.results.length; idx++) {
    const r = session.results[idx];
    const a = r.aiAnalysis;

    const isInstNotAnalyzed =
      r.instrumentStatus?.toLowerCase().includes("tidak dianalisa") ||
      (r.instrumentZScore === null && r.instrumentTarget === null);
    const instTarget = !isInstNotAnalyzed && r.instrumentTarget !== null ? r.instrumentTarget : null;
    const instSdpa = !isInstNotAnalyzed && r.instrumentSdpa !== null ? r.instrumentSdpa : null;
    const instZ = !isInstNotAnalyzed && r.instrumentZScore !== null ? r.instrumentZScore : null;
    const instStatus = !isInstNotAnalyzed ? (r.instrumentStatus || "") : "-";

    const isMethNotAnalyzed =
      r.methodStatus?.toLowerCase().includes("tidak dianalisa") ||
      (r.methodZScore === null && r.methodTarget === null);
    const methTarget = !isMethNotAnalyzed && r.methodTarget !== null ? r.methodTarget : null;
    const methSdpa = !isMethNotAnalyzed && r.methodSdpa !== null ? r.methodSdpa : null;
    const methZ = !isMethNotAnalyzed && r.methodZScore !== null ? r.methodZScore : null;
    const methStatus = !isMethNotAnalyzed ? (r.methodStatus || "") : "-";

    const isAllNotAnalyzed =
      r.allParticipantsStatus?.toLowerCase().includes("tidak dianalisa") ||
      (r.allParticipantsZScore === null && r.allParticipantsTarget === null && r.zScore === null && r.targetValue === null);
    const allTarget = !isAllNotAnalyzed ? (r.allParticipantsTarget ?? r.targetValue) : null;
    const allSdpa = !isAllNotAnalyzed ? (r.allParticipantsSdpa ?? r.sdpa) : null;
    const allZ = !isAllNotAnalyzed ? (r.allParticipantsZScore ?? r.zScore) : null;
    const allStatus = !isAllNotAnalyzed ? (r.allParticipantsStatus ?? (r.zStatus ? STATUS_LABEL[r.zStatus] : "")) : "-";

    const overallStatus = getOverallStatusLabel(r);
    const rowLevel = getRowEvaluationLevel(r);

    const row = ws.addRow({
      no: idx + 1,
      parameter: r.parameterName,
      participant: r.participantValue ?? "",
      unit: r.unit || "",
      method: r.method || "",
      instrument: r.instrument || "",
      instrumentTarget: instTarget !== null && instTarget !== undefined ? Number(instTarget) : "",
      instrumentSdpa: instSdpa !== null && instSdpa !== undefined ? Number(instSdpa) : "",
      instrumentZScore: instZ !== null && instZ !== undefined ? Number(instZ) : "",
      instrumentStatus: instStatus || "",
      methodTarget: methTarget !== null && methTarget !== undefined ? Number(methTarget) : "",
      methodSdpa: methSdpa !== null && methSdpa !== undefined ? Number(methSdpa) : "",
      methodZScore: methZ !== null && methZ !== undefined ? Number(methZ) : "",
      methodStatus: methStatus || "",
      allParticipantsTarget: allTarget !== null && allTarget !== undefined ? Number(allTarget) : "",
      allParticipantsSdpa: allSdpa !== null && allSdpa !== undefined ? Number(allSdpa) : "",
      allParticipantsZScore: allZ !== null && allZ !== undefined ? Number(allZ) : "",
      allParticipantsStatus: allStatus || "",
      status: overallStatus,
      instrumentEvaluation: a?.instrumentEvaluation || "",
      methodEvaluation: a?.methodEvaluation || "",
      biasAnalysis: a?.biasAnalysis || "",
      interpretation: a?.interpretation || "",
      cause: formatListForCell(a?.possibleCauses),
      investigation: formatListForCell(a?.investigationSteps),
      corrective: formatListForCell(a?.correctiveActions),
      preventive: formatListForCell(a?.preventiveActions),
    });

    row.alignment = { vertical: "middle", wrapText: true };

    // Border tipis rapi pada setiap sel
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    // Pewarnaan baris sesuai status Z-Score:
    // Merah untuk Tidak Memuaskan (UNSATISFACTORY)
    // Kuning untuk Peringatan (WARNING)
    if (rowLevel === "UNSATISFACTORY") {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEE2E2" }, // Merah pastel
        };
      });
      const statusCell = row.getCell("status");
      statusCell.font = { bold: true, color: { argb: "FF991B1B" } };
      const paramCell = row.getCell("parameter");
      paramCell.font = { bold: true, color: { argb: "FF991B1B" } };
    } else if (rowLevel === "WARNING") {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" }, // Kuning pastel
        };
      });
      const statusCell = row.getCell("status");
      statusCell.font = { bold: true, color: { argb: "FF92400E" } };
      const paramCell = row.getCell("parameter");
      paramCell.font = { bold: true, color: { argb: "FF92400E" } };
    }
  }

  // Format angka 2 desimal untuk kolom target & Z-score
  ["G", "H", "I", "K", "L", "M", "O", "P", "Q"].forEach((colLetter) => {
    ws.getColumn(colLetter).numFmt = "0.00";
    ws.getColumn(colLetter).alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.getColumn("A").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("C").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("D").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("J").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("N").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("R").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("S").alignment = { vertical: "middle", horizontal: "center" };

  // Identitas Sheet
  const info = wb.addWorksheet("Identitas Dokumen");
  info.columns = [
    { header: "Field", key: "f", width: 22 },
    { header: "Nilai / Keterangan", key: "v", width: 50 },
  ];
  info.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  info.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D7A69" } };
  [
    ["Laboratorium", session.laboratoryName || session.organization.name],
    ["Penyelenggara (Provider)", session.provider],
    ["Program PME", session.program],
    ["Siklus", session.cycle],
    ["Periode", session.period],
    ["Nomor Peserta", session.participantId],
    ["Nama Berkas PDF", session.file?.fileName],
    ["Versi Aturan Z-Score", session.ruleVersion],
    ["Metode Validasi", "Standar ISO 13528 & Permenkes"],
    ["Tanggal Unggah", session.createdAt.toLocaleString("id-ID")],
  ].forEach(([f, v]) => info.addRow({ f, v: v ?? "-" }));

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/* ========================================================================== */
/*       EXCEL MODEL 2 (FORMAT TEMPLATE ASLI: EVALUASI PME.xlsx 5 KOLOM)      */
/* ========================================================================== */

export async function generateExcelReportModel2(sessionId: string, organizationId: string): Promise<Buffer> {
  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, ...(organizationId === "ALL" ? {} : { organizationId }) },
    include: {
      file: true,
      results: { include: { aiAnalysis: true, capaActions: true }, orderBy: { parameterName: "asc" } },
      organization: true,
    },
  });
  if (!session) throw new Error("Sesi PME tidak ditemukan");

  const wb = new ExcelJS.Workbook();
  wb.creator = "didikpme - Evaluasi Mutu PME";
  wb.created = new Date();

  const ws = wb.addWorksheet("Sheet1");

  // Title info at top rows
  ws.getCell("B2").value = "FORMULIR EVALUASI DAN TINDAK LANJUT HASIL PEMANTAPAN MUTU EKSTERNAL (PME)";
  ws.getCell("B2").font = { bold: true, size: 12 };

  ws.getCell("B3").value = `Laboratorium: ${session.laboratoryName || session.organization.name}  |  Program: ${session.program || "Kimia Klinik"}  |  Siklus: ${session.cycle || "-"}  |  Periode: ${session.period || "-"}`;
  ws.getCell("B3").font = { size: 10, italic: true };

  // Row 5 is header per the uploaded template EVALUASI PME.xlsx
  const headerRow = ws.getRow(5);
  headerRow.values = [null, "No.", "Sasaran", "Hasil Pencapain", "Rencana Perbaikan", "Penanggung Jawab"];
  headerRow.height = 28;
  headerRow.font = { bold: true, size: 10, color: { argb: "FF000000" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  // Styling columns B to F
  ws.getColumn(2).width = 8;   // No.
  ws.getColumn(3).width = 32;  // Sasaran
  ws.getColumn(4).width = 36;  // Hasil Pencapain
  ws.getColumn(5).width = 55;  // Rencana Perbaikan
  ws.getColumn(6).width = 24;  // Penanggung Jawab

  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FF999999" } },
    left: { style: "thin" as const, color: { argb: "FF999999" } },
    bottom: { style: "thin" as const, color: { argb: "FF999999" } },
    right: { style: "thin" as const, color: { argb: "FF999999" } },
  };

  // Border for header cells
  for (let c = 2; c <= 6; c++) {
    const cell = headerRow.getCell(c);
    cell.border = thinBorder;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F0ED" } };
  }

  // Populate data rows starting at row 6
  let curRow = 6;
  session.results.forEach((r, idx) => {
    const a = r.aiAnalysis;
    const isAnalyzed = getRowEvaluationLevel(r) !== "NOT_ANALYZED";
    const zStr = isAnalyzed && r.zScore !== null ? (r.zScore > 0 ? `+${fmt(r.zScore, 2)}` : fmt(r.zScore, 2)) : "-";
    const statusStr = isAnalyzed ? (STATUS_LABEL[r.zStatus || ""] || "Perlu Review") : "-";

    const sasaran = `Pemeriksaan ${r.parameterName}` + (r.method ? `\n(Metode: ${r.method})` : "");
    const pencapaian = isAnalyzed
      ? `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nTarget: ${r.targetValue ?? "-"}\nSDPA: ${r.sdpa ?? "-"}\nZ-Score: ${zStr} (${statusStr})`
      : `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nTarget: -\nSDPA: -\nZ-Score: - (-)`;

    let perbaikan = "";
    if (!isAnalyzed) {
      perbaikan = "-";
    } else if (a?.correctiveActions) {
      const corrective = safeParseArray(a.correctiveActions);
      const preventive = safeParseArray(a.preventiveActions);
      const cLines = corrective.map((c, i) => `${i + 1}. ${c}`).join("\n");
      const pLines = preventive.map((p, i) => `${i + 1}. ${p}`).join("\n");
      perbaikan = [cLines, pLines ? `Pencegahan:\n${pLines}` : ""].filter(Boolean).join("\n\n");
    } else if (r.zStatus === "SATISFACTORY") {
      perbaikan = "Pertahankan mutu pengujian dengan monitoring harian IQC dan pemeliharaan instrumen rutin.";
    } else {
      perbaikan = "Evaluasi reagen dan lakukan verifikasi bahan kontrol.";
    }

    const pic = r.capaActions?.[0]?.pic || "Analis QA / Ka Lab";

    const row = ws.getRow(curRow);
    row.values = [null, idx + 1, sasaran, pencapaian, perbaikan, pic];
    row.alignment = { vertical: "middle", wrapText: true };

    row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(6).alignment = { vertical: "middle", horizontal: "center" };

    for (let c = 2; c <= 6; c++) {
      row.getCell(c).border = thinBorder;
    }

    curRow += 1;
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function formatListForCell(json: string | null | undefined): string {
  if (!json) return "";
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return "";
    return parsed
      .map((item) => {
        if (typeof item === "string") return `• ${item}`;
        if (item && typeof item === "object") {
          const c = item as { category?: string; text?: string };
          return `• [${c.category || "?"}] ${c.text || ""}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  const lines = doc.splitTextToSize(text || "-", maxWidth) as string[];
  lines.forEach((line) => {
    doc.text(line, x, y);
    y += 4.5;
  });
  return y;
}
