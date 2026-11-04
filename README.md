# Afnan Assistant 📱

Aplikasi Android pribadi **100% offline** untuk:

1. **Planner**: kalender kegiatan, pengingat, tandai selesai, daftar *Mendatang* dan *Terlewat*.
2. **Habit Tracker**: habit harian, mingguan, dan bulanan, lengkap dengan ceklis, streak, riwayat, dan pengingat otomatis.
3. **Manajemen Keuangan**: pemasukan, pengeluaran, transfer, kas (Tunai/BRI/BSI/GoPay/…), kategori, **Ranggar** (rancangan anggaran), **Goals** tabungan, foto bukti, dan **Brankas Rahasia** ber-PIN untuk hutang serta kredensial (password, email, rekening, PIN, tanggal penting).
4. **Evaluasi**: skor dan grafik kinerja habit, planner, dan keuangan.
5. **Foto Pengingat**: foto kecil yang muncul di form pengeluaran, peringatan anggaran, dan tempat lain (misalnya foto istri yang lagi marah 😅).

Semua data tersimpan **hanya di HP** (IndexedDB di dalam aplikasi). Aplikasi tidak pernah mengirim data ke internet.

---

## Daftar isi
1. [Cara mendapatkan APK](#1-cara-mendapatkan-apk)
   - [Cara A: Build otomatis lewat GitHub (disarankan, tanpa install apa pun)](#cara-a--build-otomatis-lewat-github-disarankan)
   - [Cara B: Build di laptop dengan Android Studio](#cara-b--build-di-laptop-dengan-android-studio)
2. [Instal di HP](#2-instal-di-hp)
3. [Pengaturan wajib agar pengingat tepat waktu](#3-pengaturan-wajib-agar-pengingat-tepat-waktu)
4. [Panduan pemakaian](#4-panduan-pemakaian)
5. [Backup & pindah HP](#5-backup--pindah-hp)
6. [Memperbarui aplikasi](#6-memperbarui-aplikasi)
7. [Mencoba di browser laptop](#7-mencoba-di-browser-laptop-opsional)
8. [Pemecahan masalah](#8-pemecahan-masalah)
9. [Struktur proyek](#9-struktur-proyek)

---

## 1. Cara mendapatkan APK

### Cara A: Build otomatis lewat GitHub (disarankan)

GitHub akan membuild APK di server mereka (gratis), jadi Anda tidak perlu meng-install Android Studio.

1. Buat akun di <https://github.com> (jika belum punya).
2. Klik **New repository** → nama misalnya `afnan-assistant` → pilih **Private** → **Create repository**.
   > Pilih **Private** karena repo berisi kunci tanda tangan aplikasi (`keystore/debug.keystore`).
3. Di halaman repo, klik **uploading an existing file**, lalu seret (drag) **semua isi** folder `afnan-assistant` (bukan folder induknya) → **Commit changes**.
4. **Penting:** periksa apakah folder `.github` ikut terunggah (folder berawalan titik kadang terlewat). Jika tidak ada:
   - Klik **Add file → Create new file**.
   - Ketik nama file: `.github/workflows/build-apk.yml`.
   - Salin seluruh isi file `.github/workflows/build-apk.yml` dari proyek ini, tempel, lalu **Commit**.
5. Buka tab **Actions**. Jika diminta, klik **I understand my workflows, go ahead and enable them**.
6. Pilih **Build APK Afnan Assistant** → **Run workflow** → **Run workflow**. (Workflow juga berjalan otomatis setiap kali ada commit.)
7. Tunggu ±5–8 menit sampai tanda ✅ hijau muncul.
8. Unduh APK dengan salah satu cara:
   - **Releases** (menu kanan halaman repo) → `AfnanAssistant.apk`. Cara ini paling mudah dari HP.
   - atau buka run di tab **Actions** → bagian **Artifacts** → `AfnanAssistant-APK` (file .zip, ekstrak untuk mendapatkan `.apk`).

### Cara B: Build di laptop dengan Android Studio

Kebutuhan: **Node.js 20+**, **Android Studio** (terbaru), **JDK 21** (sudah ikut Android Studio).

```bash
cd afnan-assistant
npm install
npx cap add android
node scripts/patch-android.mjs
npx cap sync android

# (agar APK ditandatangani dengan kunci yang sama setiap build)
# Windows : copy keystore\debug.keystore %USERPROFILE%\.android\debug.keystore
# Mac/Linux: cp keystore/debug.keystore ~/.android/debug.keystore

npx cap open android
```

Di Android Studio: tunggu proses *Gradle sync* selesai → menu **Build → Build App Bundle(s)/APK(s) → Build APK(s)**.
APK ada di `android/app/build/outputs/apk/debug/app-debug.apk`.
Bisa juga langsung **Run ▶** ke HP yang tersambung dengan USB (aktifkan *USB debugging*).

> Setelah mengubah kode di folder `www/`, jalankan `npx cap sync android` lalu build ulang.

---

## 2. Instal di HP

1. Kirim file `AfnanAssistant.apk` ke HP (atau unduh langsung dari Releases di HP).
2. Buka file tersebut. Jika muncul peringatan, izinkan **Instal aplikasi tidak dikenal** untuk aplikasi pembuka file (Chrome / File Manager).
3. Jika Play Protect memberi peringatan, pilih **Detail lainnya → Tetap instal**. Peringatan ini wajar untuk aplikasi pribadi yang tidak dari Play Store.
4. Buka **Afnan Assistant** → izinkan **Notifikasi**.
5. Isi nama panggilan → **Mulai** → atur **saldo awal** setiap kas di *Keuangan → Kas*.

Minimal Android 6.0. Disarankan Android 10 ke atas.

---

## 3. Pengaturan wajib agar pengingat tepat waktu

Notifikasi dijadwalkan di HP (tanpa internet). Beberapa merek HP mematikan aplikasi di latar belakang, jadi lakukan sekali saja:

| Pengaturan | Caranya |
|---|---|
| Izin notifikasi | Pengaturan HP → Aplikasi → Afnan Assistant → Notifikasi → **Izinkan** |
| Alarm & pengingat | Di aplikasi: *Pengaturan → Izin alarm tepat* → aktifkan |
| Baterai | Pengaturan HP → Aplikasi → Afnan Assistant → Baterai → **Tidak dibatasi / Unrestricted** |
| Xiaomi / Redmi / POCO | Aktifkan **Autostart** dan set *Penghemat baterai* = **Tidak ada batasan** |
| Oppo / Realme / Vivo | Aktifkan **Izinkan aktivitas latar belakang / Auto-launch** |
| Samsung | Baterai → hapus dari *Aplikasi yang ditidurkan* |

Lalu uji: *Pengaturan → Tes notifikasi* (muncul dalam 5 detik).

> Jadwal pengingat diperbarui otomatis setiap kali Anda membuka aplikasi atau mengubah data. Buka aplikasi minimal sesekali (misalnya seminggu sekali) agar jadwal kegiatan jauh hari tetap terisi.

---

## 4. Panduan pemakaian

### 🏠 Beranda
Ringkasan hari ini: saldo kas (ketuk 👁 untuk menyembunyikan nominal), tombol cepat (Pengeluaran, Pemasukan, Kegiatan), agenda hari ini, habit hari ini, anggaran, goal, dan transaksi terakhir. Peringatan muncul jika ada kegiatan terlewat, atau saat akhir pekan/akhir bulan untuk mengisi habit.

### 📅 Planner
- **Kalender**: titik berwarna menandai kegiatan (merah = terlewat). Ketuk tanggal untuk melihat daftarnya.
- **+** untuk menambah kegiatan: judul, tanggal, jam (atau sepanjang hari), kategori, prioritas, **pengingat** (tepat waktu sampai 1 hari sebelum), **pengulangan** (harian, mingguan, bulanan, tahunan), lokasi, catatan.
- Ketuk ⭕ untuk **menandai selesai**.
- Tab **Mendatang** (30 hari), **Terlewat** (60 hari terakhir, bisa dipindah ke hari ini), dan **Semua**.
- Notifikasi **ringkasan agenda pagi** (default 06:30) hanya muncul pada hari yang ada kegiatannya.

### ✅ Habit
- Tiga jenis: **Harian** (bisa dipilih hari aktifnya, mis. Senin–Jumat), **Mingguan**, **Bulanan**.
- Ketuk kotak untuk ceklis. Gunakan panah ‹ › untuk melengkapi ceklis periode lalu yang terlupa.
- Pengingat default: harian tiap **21:00**, mingguan tiap **Minggu 19:00**, bulanan di **hari terakhir bulan 20:00** (bisa diubah di Pengaturan).
- Ketuk habit untuk melihat streak 🔥, rekor, persentase konsistensi, dan peta riwayat.

### 💰 Keuangan
| Tab | Fungsi |
|---|---|
| **Ringkasan** | Saldo total, arus bersih, rata-rata harian, distribusi kas (donat), karakteristik pengeluaran, grafik harian, sumber pemasukan, progres goals |
| **Transaksi** | Daftar per hari, pencarian, filter, detail + foto bukti, duplikat, ekspor CSV |
| **Anggaran** | Ranggar per bulan per kategori, persentase realisasi, proyeksi akhir bulan, pos di luar anggaran. Bisa *salin bulan lalu* atau *isi rata-rata 3 bulan* |
| **Goals** | Target tabungan (mis. MOBIL Rp145 jt), tombol **Tabung**, pesan penyemangat, estimasi per bulan sesuai tenggat, konfeti + foto saat tercapai |
| **Kas** | Tempat uang (Tunai, BRI, BSI, GoPay, …), saldo awal, *sesuaikan saldo*, transfer antar kas, mutasi |
| **Kategori** | Kategori pemasukan & pengeluaran. Tiap kategori pengeluaran bisa diberi **foto pengingat khusus** |

**Mencatat transaksi:** pilih jenis → nominal (tersedia tombol cepat +10rb dst.) → kategori → kas → tanggal & jam (otomatis terisi) → keterangan → foto bukti (kamera/galeri, opsional).
Jika kategori punya anggaran, sisa anggaran langsung tampil. Saat anggaran ≥80% atau terlampaui, foto peringatan muncul.

**Cara kerja Goals:** menabung = pengeluaran berkategori **Tabungan Goals** dengan sub-kategori nama goal. Saldo kas berkurang dan uangnya "dikunci" di goal. Goal yang sudah tercapai **tidak dihapus**: ia pindah ke bagian 🏆 *Tercapai* dan tidak lagi muncul sebagai sub-kategori. Tombol **Tarik** mengembalikan dana goal ke kas.

### 🔐 Brankas Hutang (rahasia)
- **Cara membuka:** di layar **Keuangan**, **tekan lama (±1 detik) tulisan judul "Keuangan"** di bagian atas.
  (Opsional: tampilkan pintasan tab "Brankas" lewat ⚙️ di dalam brankas.)
- Pertama kali, Anda diminta membuat **PIN 6 digit**.
- Data hutang **dienkripsi (AES-256)** dengan PIN. Tanpa PIN, isinya tidak bisa dibaca, termasuk dari file backup.
- Catat: **asal hutang** (Bank BRI, Koperasi, perorangan…), keterangan, jumlah pokok, **cicilan per bulan**, tanggal jatuh tempo, tenor.
- **Bayar**: sisa hutang berkurang. Bisa dipotong dari kas; transaksinya hanya tampil sebagai "Pembayaran Cicilan" tanpa detail.
- Tampil: total sisa, total cicilan/bulan, **sisa per asal hutang**, perkiraan berapa bulan lagi lunas, status bulan ini.
- Notifikasi jatuh tempo bersifat **diskret** ("Ada pembayaran terjadwal hari ini") tanpa menyebut hutang.
- Brankas **terkunci otomatis** saat Anda keluar dari layarnya atau meninggalkan aplikasi.
- **Lupa PIN?** *Pengaturan → Lupa PIN Brankas* akan menghapus data brankas (karena terenkripsi, data itu tidak bisa dipulihkan).

### 🔑 Kredensial Rahasia (di dalam Brankas)
Buka Brankas (tekan lama judul "Keuangan" lalu masukkan PIN), kemudian pilih tab **🔑 Kredensial**. Jenis yang bisa disimpan:
- **Akun / Password**: situs, username/email, password. Ada tombol 🎲 untuk membuat password acak.
- **Email**: alamat, password, email/nomor pemulihan.
- **Rekening**: bank, nama pemilik, nomor rekening, PIN m-banking.
- **PIN / Kode**: misalnya PIN ATM.
- **Kartu**, **Wi-Fi**, **Catatan** bebas.
- **Tanggal Penting**: misalnya ulang tahun atau anniversary, dengan hitung mundur tahunan. Tanggal yang jatuh dalam 30 hari ke depan tampil paling atas.

Setiap kolom bisa ditandai **Rahasia**. Kolom rahasia tampil sebagai `••••`. Ketuk 👁 untuk melihat isinya dan 📋 untuk menyalin. Anda juga bisa menambah kolom sendiri, menandai item sebagai ⭐ favorit, dan mencari item. Semua data kredensial dienkripsi bersama data hutang dengan PIN brankas, termasuk di dalam file backup.

### 📊 Evaluasi
Pilih rentang **1 bulan / 3 bulan / 6 bulan / 1 tahun**. Yang ditampilkan:
- **Skor keseluruhan (A–D)** dan skor per modul.
- **Catatan & saran** otomatis (habit terkuat/terlemah, hari paling sering terlewat, hari paling boros, kenaikan pengeluaran, rasio cicilan, dll).
- Habit: tren ketercapaian, peta konsistensi harian, persentase per habit.
- Planner: selesai vs terlewat, per kategori, pola hari terlewat.
- Keuangan: pemasukan vs pengeluaran 6+ bulan, kekayaan bersih, komposisi pengeluaran, pola harian, pengeluaran terbesar, rasio cicilan (jika brankas dibuka).

Ketuk batang atau titik grafik untuk melihat angkanya.

### 👤 Profil: nama aplikasi & foto
*Pengaturan → Profil & Tampilan*
- **Foto profil**: pilih dari galeri. Foto otomatis dipotong persegi, lalu tampil di Beranda dan layar pembuka.
- **Nama aplikasi**: mengganti judul di Beranda dan di layar pembuka.
- Nama dan ikon yang tampil di layar utama HP (launcher) tetap mengikuti APK. Untuk menggantinya, ubah `appName` di `capacitor.config.json` lalu build ulang.

### 🖼️ Foto Pengingat
*Beranda → ⚙️ Pengaturan → Foto Pengingat*
1. **Unggah** foto ke galeri dan beri label (mis. "Istri marah", "Istri senang", "Mobil impian").
2. **Pasang foto di…**: Form Pengeluaran, Peringatan Anggaran, Form Pemasukan, Goal Tercapai, Beranda. Masing-masing bisa diberi pesan sendiri.
3. Foto khusus per kategori: *Keuangan → Kategori → pilih kategori*. Contoh: kategori **Hiburan** diberi foto istri marah dengan pesan "Jangan nonton terus!".
4. Foto goal: atur saat membuat/mengubah goal.

Foto otomatis diperkecil supaya hemat memori.

---

## 5. Backup & pindah HP

Karena data hanya ada di HP, **lakukan backup secara rutin**.

- **Backup otomatis mingguan** (aktif secara default) disimpan ke `Documents/AfnanAssistant/afnan-autobackup.json`.
- **Simpan backup**: file `afnan-backup-YYYYMMDD-HHMM.json` disimpan di `Documents/AfnanAssistant/`.
- **Bagikan backup**: kirim ke Google Drive / WhatsApp / email (disarankan sebulan sekali).
- **Pulihkan**: *Pengaturan → Pulihkan* → pilih file `.json` → data diganti dengan isi backup.
- **Ekspor CSV**: transaksi bisa dibuka di Excel/Google Sheets.

Pindah HP: buat backup (sertakan foto) → bagikan ke Drive → instal APK di HP baru → *Pulihkan*.

---

## 6. Memperbarui aplikasi

Semua build memakai kunci tanda tangan yang sama (`keystore/debug.keystore`), jadi **APK baru bisa langsung dipasang di atas versi lama tanpa kehilangan data**.
**Jangan hapus atau ganti file keystore.** Kalau keystore hilang, APK baru tidak bisa menimpa versi lama. Anda harus uninstall dulu, dan data ikut terhapus (pulihkan dari backup).

Langkah update via GitHub: ubah file di repo → commit → Actions membuild otomatis → unduh APK terbaru dari Releases → instal.

---

## 7. Mencoba di browser laptop (opsional)

Untuk melihat tampilan atau mengubah desain tanpa build APK:

```bash
cd afnan-assistant/www
python -m http.server 8080      # atau: npx http-server -p 8080
```
Buka <http://localhost:8080> di Chrome, tekan F12, lalu aktifkan mode perangkat seluler.
Data di browser terpisah dari data di HP. Notifikasi hanya bekerja di APK.

---

## 8. Pemecahan masalah

| Masalah | Solusi |
|---|---|
| Notifikasi tidak muncul | Lihat [bagian 3](#3-pengaturan-wajib-agar-pengingat-tepat-waktu), lalu tekan *Tes notifikasi* |
| Pengingat terlambat beberapa menit | Aktifkan *Izin alarm tepat* dan set baterai = *Tidak dibatasi* |
| "Aplikasi tidak terpasang" saat update | APK ditandatangani kunci berbeda. Backup → uninstall → instal → pulihkan |
| Actions gagal di langkah `npm install`/`gradlew` | Klik **Re-run jobs** (biasanya gangguan jaringan sementara). Pastikan file `package.json` dan `capacitor.config.json` ada di akar repo |
| Workflow tidak muncul di tab Actions | Folder `.github/workflows/` belum terunggah. Lihat langkah 4 Cara A |
| Lupa PIN brankas | *Pengaturan → Lupa PIN Brankas* (data hutang terhapus) |
| Data hilang setelah "Hapus data" aplikasi di pengaturan Android | Pulihkan dari file backup |

---

## 9. Struktur proyek

```
afnan-assistant/
├── www/                      # Seluruh aplikasi (HTML/CSS/JS, tanpa library eksternal)
│   ├── index.html
│   ├── css/app.css           # Tema terang/gelap
│   └── js/
│       ├── app.js            # Router, inisialisasi, tombol back Android
│       ├── state.js          # Data, perhitungan keuangan, enkripsi brankas
│       ├── db.js             # Penyimpanan IndexedDB
│       ├── logic.js          # Logika kegiatan berulang & periode habit
│       ├── notify.js         # Penjadwalan notifikasi lokal
│       ├── native.js         # Jembatan Capacitor (notifikasi, file, share)
│       ├── charts.js         # Grafik SVG (donat, batang, garis, ring)
│       ├── ui.js, icons.js, utils.js
│       └── views/            # home, planner, habits, finance, vault, eval, settings
├── android-res/res/          # Ikon aplikasi & ikon notifikasi
├── scripts/patch-android.mjs # Izin, ikon, versi untuk proyek Android
├── keystore/debug.keystore   # Kunci tanda tangan tetap (JANGAN dihapus)
├── capacitor.config.json
├── package.json
└── .github/workflows/build-apk.yml   # Build APK otomatis di GitHub
```

Teknologi: [Capacitor 7](https://capacitorjs.com) (WebView Android) + plugin resmi *Local Notifications, App, Filesystem, Share*. Antarmuka ditulis dengan JavaScript murni tanpa framework, sehingga ringan dan sepenuhnya offline. Font: Poppins (SIL Open Font License), sudah disertakan di `www/fonts`. Logo: `www/img/logo.svg`.
