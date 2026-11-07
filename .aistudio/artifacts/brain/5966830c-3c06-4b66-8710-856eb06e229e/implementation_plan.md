# Penyeragaman Ukuran Cetak PDF & Print Browser ke Standar A4 Portrait Resmi

Menyeragamkan seluruh keluaran dokumen PDF (Laporan Proyek H1–H5 dan Slip Gaji) serta tampilan Cetak (*Print*) langsung dari browser ke ukuran kertas **A4 Portrait (210 mm × 297 mm)** dengan mempertahankan proporsi Kop Surat resmi **PT ASTABRATA MATAHARI TERBIT**, keterbacaan ukuran font, dan kerapian tabel tanpa teks bertumpuk atau terpotong.

## User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh preferensi tata letak A4 telah dikonfirmasi dan menjadi acuan utama implementasi:

- **Confirmed Decision 1 (Orientasi Kertas A4 Portrait Seragam)**: Seluruh dokumen PDF termasuk Laporan H1 (Rekap Gaji & Kehadiran Per Karyawan), H2 (Rekap Total Gaji Seluruh Karyawan), H3 (Biaya Transportasi), H4 (Operasional Lapangan), H5 (Rekapitulasi Seluruh Pengeluaran Proyek), dan Slip Gaji diseragamkan menggunakan ukuran **A4 Portrait (210 mm × 297 mm)** persis seperti dokumen referensi Kop Surat.
- **Confirmed Decision 2 (Penyesuaian Lebar Kolom Proporsional di A4)**: Tabel dengan banyak kolom (seperti H1, H2, dan H3) diatur menggunakan alokasi lebar kolom otomatis dan terukur (*proportional column widths*) pada area cetak efektif **186 mm** (lebar A4 210 mm dikurangi margin kiri-kanan 12 mm) dengan perataan angka *tabular* rata kanan, sehingga seluruh kolom muat secara utuh di kertas A4 Portrait tanpa mengecilkan ukuran huruf secara berlebihan.
- **Confirmed Decision 3 (Kunci Rasio & Margin A4 di Unduhan PDF dan Browser Print)**: Penguncian dimensi kertas `@page { size: A4 portrait; margin: 10mm 12mm; }` diterapkan baik pada generator file PDF maupun pada tampilan *Print* langsung dari browser.

---

## 1. Overview & Core Concept

- **What It Does**: Mengatur ulang geometri halaman, Kop Surat, kotak ringkasan informasi proyek/karyawan, dan tabel data pada seluruh fitur cetak agar presisi mengikuti dimensi kertas **A4 Portrait (210 mm × 297 mm)**.
- **Target Audience / Persona**: Pimpinan (*Owner*) dan Administrator Proyek PT Astabrata Matahari Terbit yang mencetak laporan resmi perusahaan di kertas A4 standar kantor.
- **Key Value**: Dokumen siap cetak (*print-ready*) di kertas A4 standar tanpa perbedaan ukuran halaman antar laporan (tidak ada lagi percampuran halaman Landscape dan Portrait saat dijilid atau diarsipkan), dengan ukuran huruf dan tabel yang tetap tajam dan mudah dibaca.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. Pengguna memilih laporan (H1–H5 atau Slip Gaji) lalu menekan tombol **Unduh PDF** atau **Cetak / Print**.
  2. Sistem menghasilkan halaman berukuran **A4 Portrait (210 mm × 297 mm)** dengan Kop Surat resmi di bagian atas setiap halaman, informasi proyek dan ringkasan yang tertata dalam grid dua kolom proporsional, serta tabel data yang rata penuh mengikuti margin kiri-kanan Kop Surat.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Dokumen korporat resmi (*Official Corporate Document*) yang bersih, presisi, dan mudah dipindai.
  - *Color Palette & Mood*:
    - **Navy Korporat (`#0B3070`)**: Judul Kop Surat, garis pembatas utama, dan tajuk (*header*) tabel.
    - **Emas Korporat (`#BE870F` / `#DDAA22`)**: Subjudul bidang usaha dan aksen garis kedua Kop Surat.
    - **Netral Kertas (`#FFFFFF` & `#F8FAFC`)**: Latar kertas A4 bersih dengan kotak ringkasan abu-abu muda berbingkai halus (`#E2E8F0`).
  - *Typography & Hierarchy*:
    - Nama Perusahaan pada Kop Surat: **16.5 pt Bold** (identik di semua halaman A4 Portrait).
    - Subjudul & Alamat Kop Surat: **8.2 pt – 9.2 pt** terpusat secara simetris di samping logo resmi.
    - Isi Tabel & Angka Keuangan: **7.2 pt – 8.5 pt** dengan perataan angka rata kanan (*right-aligned tabular figures*) agar nominal Rupiah tidak terpotong atau turun baris secara acak.
  - *Component Styling & Layout*:
    - Lebar Kertas A4 Portrait: **210 mm**, Tinggi: **297 mm**.
    - Margin Kiri & Kanan: **12 mm** (Area cetak efektif: **186 mm**).
    - Kotak Ringkasan Karyawan pada H1: Ditata dalam 3 baris terstruktur di dalam lebar 186 mm sehingga rincian tarif harian, jam lembur, gaji pokok, potongan kasbon, dan gaji bersih memiliki ruang baca yang lega tanpa tumpang tindih.
- **Interactive Feedback & Motion**: Pratinjau cetak dan proses pembuatan PDF berjalan instan dengan pemberitahuan status (*toast notification*) yang halus.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Alokasi Lebar Kolom Terukur (*Explicit Column Widths*) pada A4 Portrait**
  - *Chosen Approach*: Menetapkan distribusi lebar kolom spesifik (*column styles*) dan perataan kanan (*right align*) untuk kolom nominal Rupiah pada tabel H1, H2, H3, H4, H5, dan Slip Gaji agar pas di lebar efektif **186 mm**.
  - *Why*: Pada orientasi A4 Portrait, pembagian lebar kolom rata otomatis sering membuat kolom angka yang pendek memakan terlalu banyak ruang sementara kolom nama/keterangan menjadi sempit. Dengan alokasi lebar kolom proporsional, ukuran huruf tetap terjaga (**7.2 pt – 8.5 pt**) dan tidak ada teks yang bertumpuk.
  - *Alternatives Considered*: Mengecilkan ukuran font hingga di bawah 5.5 pt — ditolak karena sulit dibaca saat dicetak di kertas fisik.
- **Decision 2: Penguncian Aturan `@page` A4 Portrait pada CSS Cetak Browser**
  - *Chosen Approach*: Menambahkan deklarasi `@page { size: A4 portrait; margin: 10mm 12mm; }` dan menyesuaikan lebar kontainer cetak agar tabel pada mode *Print* browser mengikuti lebar kertas A4 tanpa *horizontal scrollbar* atau kolom terpotong.
  - *Why*: Memastikan hasil cetak langsung dari dialog *Print* browser sama rapi dan konsistennya dengan file hasil unduhan PDF.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Layout Geometry Diagram**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                   LEMBAR DOKUMEN A4 PORTRAIT (210 mm × 297 mm)       │
│                   Margin Kiri: 12 mm  |  Margin Kanan: 12 mm         │
│                         Lebar Area Cetak Efektif: 186 mm             │
├──────────────────────────────────────────────────────────────────────┤
│  [LOGO 25×25mm]     PT ASTABRATA MATAHARI TERBIT        (16.5pt Bold)│
│                  GENERAL CONTRACTOR, SUPPLIER & INTERIOR (9.2pt Gold)│
│                  Alamat & Kontak Resmi Perusahaan        (8.2pt Gray)│
│  ══════════════════════════════════════════════════════════════════  │
│  (Garis Ganda Resmi: Biru Navy #0B3070 + Emas #DDAA22)               │
├──────────────────────────────────────────────────────────────────────┤
│  JUDUL LAPORAN (H1 / H2 / H3 / H4 / H5 / SLIP GAJI)    Kode & Waktu  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Kotak Metadata Proyek (2 Kolom Simetris — Lebar 186 mm)        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Kotak Ringkasan Karyawan H1 (3 Baris Terstruktur — 186 mm)     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────┬──────────┬──────────┬─────────┬─────────┬────────┬────────┐  │
│  │ No │ Karyawan │ Kehadiran│  Pokok  │ Lembur  │ Kasbon │ Bersih │  │
│  ├────┼──────────┼──────────┼─────────┼─────────┼────────┼────────┤  │
│  │ Proporsional Column Widths (Total 186 mm) & Font 7.2pt - 8.5pt │  │
│  └────┴──────────┴──────────┴─────────┴─────────┴────────┴────────┘  │
│                                                                      │
│  Disiapkan Oleh (Admin)                 Disetujui Oleh (Owner)       │
│  ──────────────────────────────────────────────────────────────────  │
│  Footer Resmi PT Astabrata Matahari Terbit         Halaman X dari Y  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**: Menggunakan data rekapitulasi proyek, kehadiran, lembur, kasbon, transportasi, dan operasional yang sudah tersinkronisasi tanpa mengubah struktur database atau perhitungan keuangan.
- **Interactive Component & State Mapping**:
  - Tombol **Unduh PDF (H1–H5 & Slip Gaji)**: Memanggil generator dokumen dengan konfigurasi `orientation: 'portrait'`, `format: 'a4'`, `unit: 'mm'`, Kop Surat di setiap halaman, dan distribusi lebar kolom proporsional.
  - Tombol **Cetak / Print Browser**: Memicu mode cetak `@media print` dengan ukuran halaman terkunci ke `A4 portrait`, menyembunyikan elemen navigasi aplikasi, dan menampilkan Kop Surat serta tabel laporan secara utuh.
