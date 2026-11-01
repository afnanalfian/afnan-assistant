// Menyesuaikan proyek Android hasil `npx cap add android`:
// - ikon aplikasi & ikon notifikasi
// - izin notifikasi / alarm tepat waktu / penyimpanan
// - targetSdk 34 (hindari tampilan edge-to-edge paksa di Android 15)
// - versionCode/versionName
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = path.join(root, 'android', 'app');
if (!fs.existsSync(app)) { console.error('Folder android/ belum ada. Jalankan: npx cap add android'); process.exit(1); }

// 1) Salin resource ikon
const copyDir = (src, dst) => {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
};
copyDir(path.join(root, 'android-res', 'res'), path.join(app, 'src', 'main', 'res'));
console.log('✔ Ikon disalin');

// 2) Manifest
const mf = path.join(app, 'src', 'main', 'AndroidManifest.xml');
let xml = fs.readFileSync(mf, 'utf8');
const perms = [
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
];
for (const p of perms) {
  const name = p.match(/name="([^"]+)"/)[1];
  if (!xml.includes(`"${name}"`)) xml = xml.replace('</manifest>', `    ${p}\n</manifest>`);
}
if (!xml.includes('requestLegacyExternalStorage')) xml = xml.replace('<application', '<application\n        android:requestLegacyExternalStorage="true"');
fs.writeFileSync(mf, xml);
console.log('✔ AndroidManifest diperbarui');

// 3) targetSdk
const vg = path.join(root, 'android', 'variables.gradle');
if (fs.existsSync(vg)) {
  let v = fs.readFileSync(vg, 'utf8');
  v = v.replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 34');
  fs.writeFileSync(vg, v);
  console.log('✔ targetSdkVersion = 34');
}

// 4) Versi
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const bg = path.join(app, 'build.gradle');
let g = fs.readFileSync(bg, 'utf8');
const code = Number(process.env.VERSION_CODE || 0) || 1;
g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
fs.writeFileSync(bg, g);
console.log(`✔ versi ${pkg.version} (${code})`);
