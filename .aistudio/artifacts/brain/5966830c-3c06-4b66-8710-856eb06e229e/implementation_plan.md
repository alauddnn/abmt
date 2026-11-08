# Redesign UI/UX: Bagian H (Laporan & Rekapitulasi Komprehensif Proyek H1 - H5)

Melakukan perombakan visual dan pengalaman pengguna (UI/UX) secara menyeluruh pada modul laporan proyek (H1 s/d H5) agar tampil rapi, profesional, bersih, dan mudah dibaca sesuai standar sistem SaaS/ERP modern.

---

### Status: Selesai Diimplementasikan (Completed)

> [!NOTE]
> Semua tahapan redesign telah berhasil diselesaikan dan lolos kompilasi serta linting TypeScript.

---

### User Review & Critical Decisions

1. **Navigasi H1 - H5**: Menggunakan **Tab Minimalis terpadu** dengan lencana status dan filter yang hemat ruang, menggantikan deretan tombol besar yang sebelumnya menumpuk.
2. **Penyajian H1 (Rekap Gaji Per Karyawan)**: Menggunakan **Kartu Modern Per Karyawan** dengan pemisahan visual yang lega, penataan hierarki tipografi yang jelas, metrik upah yang seimbang, dan tabel catatan kehadiran harian yang tidak berjejal.
3. **Penyajian H2 (Rekap Total Seluruh Karyawan)**: Menggunakan **Tata Letak Spreadsheet Rapat (*High-Density Table*)** dengan horizontal scroll mulus, perataan angka monospaced (`tabular-nums`) rata kanan, *sticky header*, dan pemisah kolom yang halus.
4. **Penyajian H3, H4, & H5**: Merapikan ringkasan total, kartu indikator keuangan, status bukti foto, serta visualisasi penyerapan anggaran pada H5.

---

### 1. Overview & Visual Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  BAGIAN H: LAPORAN & REKAPITULASI PROYEK                               │
│  [ Cetak PDF ]  [ Print Langsung ]  [ Ekspor Excel (.xlsx) ]           │
├────────────────────────────────────────────────────────────────────────┤
│  [ H1. Rekap Per Karyawan ] [ H2. Total Seluruh ] [ H3. Transport ] ...│
├────────────────────────────────────────────────────────────────────────┤
│  Filter Bar Terpadu: Tanggal Mulai | Tanggal Akhir | Jabatan | Preset  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴────────────────────────┐
          ▼                                                  ▼
┌─────────────────────────────────┐        ┌─────────────────────────────┐
│ H1: KARTU MODERN PER KARYAWAN   │        │ H2: SPREADSHEET TINGGI      │
│ - Header ID, Role, Status       │        │ - Kolom rapi & terstruktur  │
│ - Strip Ringkasan 6 Metrik Kunci│        │ - Sticky header & hover row │
│ - Tabel Rincian Harian Rapi     │        │ - Grand total footer jelas  │
└─────────────────────────────────┘        └─────────────────────────────┘
```

---

### 2. Ringkasan Perubahan yang Diterapkan

#### A. Navigasi & Toolbar Atas
- **Header Aksi Bersih**: Menyatukan tombol ekspor utama (*Cetak PDF*, *Print Langsung*, *Ekspor Excel*) dalam toolbar yang rapi.
- **Segmented Minimalist Tabs**: Tab beralih antar H1 s/d H5 yang bersih dengan lencana jumlah/nominal ringkas dan indikator tab aktif yang tegas.
- **Filter Bar Terintegrasi**: Kotak filter tanggal dan jabatan/kategori yang lebih kompak dengan preset cepat (Semua, 2 Minggu, Bulan Ini) dalam satu kesatuan kontainer.

#### B. Sub-Modul H1: Rekap Gaji Per Karyawan
- **Struktur Kartu Berjenjang**:
  - *Header Kartu*: Nomor urut, ID Karyawan, Nama Karyawan tebal, lencana jabatan bernuansa lembut, serta tombol aksi cepat (*Detail*, *Cetak Slip*, *Unduh PDF*, *Excel*).
  - *Metric Pill Grid*: Menampilkan Tarif Pokok, Tarif Lembur, Total Pokok, Total Lembur, Potongan Kasbon, dan Gaji Bersih dalam kotak metrik bersih dengan kontras warna yang nyaman di mata.
  - *Tabel Kehadiran Lapangan*: Tabel rincian tanggal, status, jam kerja, lembur, dan potongan kasbon dengan jarak padding sel yang pas, tidak bertumpuk, dan bergaris tipis modern.

#### C. Sub-Modul H2: Rekap Total Gaji Seluruh Karyawan
- **Spreadsheet Data Grid**:
  - Mengubah tabel menjadi format spreadsheet profesional yang rapat (*compact* 36px–40px), memudahkan pembandingan antar karyawan.
  - Kolom numerik menggunakan `font-mono tabular-nums` rata kanan agar desimal dan koma ribuan tegak lurus.
  - *Hover Row Highlight* halus untuk memudahkan penelusuran data baris yang panjang.
  - Baris `GRAND TOTAL` bawah yang kontras dan tebal.

#### D. Sub-Modul H3 & H4: Biaya Transportasi & Operasional
- Kartu indikator total transaksi dan akumulasi biaya yang modern.
- Tabel transaksi dengan kolom rute, PIC, kategori, dan tombol pratinjau bukti foto yang elegan.

#### E. Sub-Modul H5: Rekap Seluruh Pengeluaran Proyek
- Panel eksekutif metrik keuangan 4 pilar: Nilai Anggaran, Total Pengeluaran, Sisa Anggaran, dan Persentase Realisasi.
- Baris progress penyerapan anggaran dengan palet warna dinamis (Hijau bila aman, Kuning/Merah bila mendekati batas).
- Tabel komparasi komponen pengeluaran terpadu dengan kolom porsi persentase (%).

---

### 3. Hasil Pengujian & Kompilasi
- `compile_applet`: Berhasil tanpa error (Build succeeded).
- `lint_applet`: `tsc --noEmit` lolos tanpa peringatan tipe data.
