# Standardisasi Kop Surat Resmi PT ASTABRATA MATAHARI TERBIT pada Seluruh Fitur Cetak & PDF

Rencana ini menyeragamkan seluruh dokumen cetak dan unduhan PDF pada sistem KMS **PT ASTABRATA MATAHARI TERBIT** menggunakan desain Kop Surat resmi sesuai dokumen referensi, sekaligus merapikan tata letak tabel dan informasi gaji agar tidak ada teks yang saling bertumpuk.

## User Review & Critical Decisions

> [!IMPORTANT]
> Keputusan berikut telah dikonfirmasi dan menjadi dasar penyusunan cetak dokumen serta PDF:

- **Kop Surat di Setiap Halaman**: Kop Surat resmi (Logo, Nama Perusahaan, Slogan Emas, Alamat Lengkap, Kontak, dan Garis Ganda Biru-Emas) akan dicetak secara konsisten di bagian atas **setiap halaman** baik pada halaman pertama maupun halaman lanjutan (termasuk halaman tanda tangan atau lanjutan tabel).
- **Adaptasi Otomatis Landscape & Portrait + Perbaikan Teks Bertumpuk**: Orientasi kertas dipertahankan sesuai kebutuhan tabel (Landscape untuk tabel lebar H1 & H2, Portrait untuk H3, H4, H5, dan Slip Gaji) dengan proporsi Kop Surat yang menyesuaikan lebar halaman secara presisi. Teks ringkasan karyawan pada laporan H1 yang sebelumnya bertumpuk akan dipisah ke baris terstruktur yang rapi.
- **Cakupan Menyeluruh (Unduhan PDF & Print Browser)**: Desain Kop Surat diterapkan secara seragam pada seluruh file unduhan PDF (Laporan Proyek H1–H5 dan Slip Gaji Karyawan) serta seluruh tampilan Print langsung dari browser.

---

## 1. Overview & Core Concept

- **What It Does**: Mengganti header teks biasa pada seluruh dokumen laporan dan slip gaji menjadi Kop Surat korporat resmi **PT ASTABRATA MATAHARI TERBIT** yang memuat logo resmi di sisi kiri, blok identitas perusahaan rata tengah, dan garis pembatas ganda berwarna biru tua & emas.
- **Target Audience / Persona**: Admin Proyek, Bagian Keuangan, dan Pimpinan/Owner saat mencetak laporan pertanggungjawaban proyek maupun slip gaji tenaga kerja.
- **Key Value**: Menghasilkan dokumen cetak dan file PDF yang sah, seragam, mudah dibaca tanpa teks bertumpuk, dan siap ditandatangani sebagai dokumen resmi perusahaan.

---

## 2. User Experience & Visual Design

- **Identitas Visual Kop Surat Resmi**:
  - **Logo Perusahaan (Sisi Kiri)**: Menampilkan logo resmi **PT ASTABRATA MATAHARI TERBIT** (`A` biru tua dengan sinar matahari emas) secara proporsional di sebelah kiri header.
  - **Tipografi & Hierarki Tengah**:
    - **Nama Perusahaan**: `PT ASTABRATA MATAHARI TERBIT` dengan huruf kapital tebal berwarna Biru Tua Korporat (`#0B2E59`).
    - **Sub-judul / Tagline**: `SOLUSI TENAGA KERJA TERPERCAYA` dengan huruf kapital tebal berwarna Emas/Amber (`#C88A1E`).
    - **Alamat Resmi**: `Jln. Kp. Panebong. Nambo Ilir, Kibin, Serang, Banten 42185` berwarna abu-abu gelap formal (`#334155`).
    - **Kontak Resmi**: `Telp. 0831-6632-6501 | Email: ptabmt20@gmail.com`.
  - **Garis Pembatas Ganda (Double Border Line)**:
    - Garis atas tebal berwarna Biru Tua (`#0B2E59`).
    - Garis bawah tipis berwarna Emas (`#C88A1E`) tepat di bawah garis biru tua.
- **Perbaikan Tata Letak Banner Rincian Karyawan (Laporan H1)**:
  - Memisahkan informasi tarif & kehadiran (baris kiri) dengan rincian nominal Gaji Pokok, Lembur, Gaji Kotor, dan Potongan Kasbon (baris bawah terpisah) menggunakan kotak ringkasan berjarak vertikal yang cukup sehingga tidak pernah saling menimpa pada ukuran kertas apa pun.
- **Kontrol Margin Multi-Halaman**:
  - Setiap kali tabel otomatis (`autoTable`) atau blok tanda tangan berpindah ke halaman baru, ruang margin atas disiapkan secara khusus agar Kop Surat resmi selalu tergambar di bagian atas halaman baru tanpa menabrak isi tabel.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Pemuatan & Penyematan Logo pada Dokumen PDF**
  - *Chosen Approach*: Memuat gambar logo resmi perusahaan dan menyematkannya langsung ke kanvas dokumen PDF menggunakan helper terpusat yang bekerja di semua orientasi halaman (Portrait & Landscape).
  - *Why*: Menjamin logo tampil tajam dan konsisten di setiap halaman PDF yang diunduh tanpa bergantung pada koneksi eksternal.
  - *Alternatives Considered*: Menggambar ulang logo secara manual dengan garis vektor sederhana (dilewati karena tidak identik dengan logo asli pada Kop Surat referensi).
- **Decision 2: Komponen Kop Surat Bersama untuk Tampilan Layar & Print Browser**
  - *Chosen Approach*: Menyediakan tata letak Kop Surat HTML/CSS khusus cetak yang identik dengan versi PDF pada area cetak Laporan Proyek, Detail Karyawan H1, Slip Gaji Proyek, Slip Gaji 2 Mingguan, dan Laporan Keuangan.
  - *Why*: Memastikan hasil tombol "Print Langsung" dari browser dan tombol "Cetak PDF" menghasilkan standar dokumen perusahaan yang sama.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│             PUSAT TEMPLATE KOP SURAT PT ASTABRATA MATAHARI TERBIT       │
│  • Logo Korporat (Kiri) + Blok Teks Tengah (Biru Tua & Slogan Emas)     │
│  • Alamat & Kontak Resmi: Kibin, Serang, Banten 42185                   │
│  • Garis Pembatas Ganda (Biru Tua Tebal + Emas Tipis)                   │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
                    ▼                                 ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│     ENGINE UNDUHAN PDF (jsPDF)        │ │   ENGINE PRINT BROWSER (DOM)  │
│  • Header Otomatis di Setiap Halaman  │ │  • Komponen Kop Surat Cetak   │
│  • Adaptif Landscape (H1, H2)         │ │  • Laporan Proyek (H1 - H5)   │
│  • Adaptif Portrait (H3, H4, H5, Slip)│ │  • Modal Slip Gaji Proyek     │
│  • Banner Karyawan H1 Anti-Bertumpuk  │ │  • Modal Slip Gaji & Laporan  │
└───────────────────────────────────────┘ └───────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - Saat pengguna menekan tombol **Cetak PDF (H1–H5)** atau **Unduh PDF Slip Gaji**, sistem merender Kop Surat resmi di halaman pertama dan mendaftarkan *page hook* otomatis agar setiap halaman tambahan yang dibuat oleh tabel atau blok tanda tangan otomatis memiliki Kop Surat di bagian atas beserta nomor halaman di bagian bawah.
  - Pada laporan **H1 (Rekap Gaji Per Karyawan)**, blok ringkasan karyawan ditata menjadi 3 baris terstruktur (Baris 1: Identitas & Jabatan + Gaji Bersih; Baris 2: Tarif Harian, Tarif Lembur, & Rekap Hari Kehadiran; Baris 3: Gaji Pokok, Upah Lembur, Gaji Kotor, Potongan Kasbon, & Sisa Kasbon) sehingga bebas dari tumpang-tindih teks.
