// ===== Jembatan ke fitur native Android (Capacitor) dengan fallback web =====
const Cap = window.Capacitor;
export const isNative = !!Cap?.isNativePlatform?.();
const plug = (n) => (isNative ? Cap.Plugins?.[n] || Cap.registerPlugin?.(n) : null);

export const Notif = plug('LocalNotifications');
export const AppP = plug('App');
export const FS = plug('Filesystem');
export const ShareP = plug('Share');

export async function ensureNotifPermission() {
  if (!Notif) return false;
  try {
    let p = await Notif.checkPermissions();
    if (p.display !== 'granted') p = await Notif.requestPermissions();
    return p.display === 'granted';
  } catch (e) { console.warn(e); return false; }
}

export async function exactAlarmStatus() {
  if (!Notif?.checkExactNotificationSetting) return 'n/a';
  try { return (await Notif.checkExactNotificationSetting()).exact_alarm; } catch (_) { return 'n/a'; }
}
export async function openExactAlarmSetting() {
  try { await Notif?.changeExactNotificationSetting?.(); } catch (_) { /* abaikan */ }
}

// Simpan file teks. Native: folder Documents/AfnanAssistant. Web: unduh.
export async function saveTextFile(name, text, mime = 'application/json') {
  if (FS) {
    try { await FS.requestPermissions?.(); } catch (_) { /* Android 11+ tidak perlu */ }
    const r = await FS.writeFile({ path: 'AfnanAssistant/' + name, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    return r.uri || 'Documents/AfnanAssistant/' + name;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return name;
}

// Bagikan file (Google Drive, WhatsApp, dll.)
export async function shareTextFile(name, text, mime = 'application/json') {
  if (FS && ShareP) {
    const r = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await ShareP.share({ title: name, files: [r.uri], dialogTitle: 'Bagikan ' + name });
    return true;
  }
  if (navigator.canShare) {
    const f = new File([text], name, { type: mime });
    if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return true; }
  }
  await saveTextFile(name, text, mime);
  return true;
}
