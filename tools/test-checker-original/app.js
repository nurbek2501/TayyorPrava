"use strict";

/* ====================================================================
   Test savollari bazasi — brauzer tomoni (lotin + kirill)
   ==================================================================== */

// ----- Holat -----
let questions = [];     // db.savollar
let editingId = null;
let form = emptyForm();

function emptyForm() {
  return {
    rasm: null,
    savol_lotin: "", savol_kirill: "", savol_kirill_touched: false,
    savol_rus: "", savol_rus_touched: false,
    variantlar: [blankOption(), blankOption(), blankOption(), blankOption()],
  };
}
function blankOption() {
  return {
    matn_lotin: "", matn_kirill: "", matn_kirill_touched: false,
    matn_rus: "", matn_rus_touched: false, rasm: null, togri: false,
  };
}

// ----- DOM -----
const el = {};
function grab() {
  [
    "stats", "formTitle", "newBtn", "qtextLat", "qtextCyr", "qtextRus", "dupStatus",
    "details", "lockOverlay", "qImageBtn", "qImageInput", "qImagePreview",
    "addOptBtn", "options", "saveBtn", "regenBtn", "translateBtn", "cancelBtn",
    "search", "list", "toasts", "downloadBtn", "backupBtn",
  ].forEach((id) => { el[id] = document.getElementById(id); });
}

// ====================================================================
//  Transliteratsiya (server bilan bir xil mantiq)
// ====================================================================

const CYR2LAT = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'ў': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'x', 'ҳ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
  'ъ': '', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ы': 'i',
};

// Takror kaliti: kirilni lotinga o'girib, faqat harf/raqam qoldiradi.
function dupKey(str) {
  str = (str || "").toLowerCase();
  let out = "";
  for (const c of str) out += (Object.prototype.hasOwnProperty.call(CYR2LAT, c) ? CYR2LAT[c] : c);
  return out.replace(/[^\p{L}\p{N}]+/gu, "");
}

const LAT2CYR_DI = { sh: 'ш', ch: 'ч', yo: 'ё', yu: 'ю', ya: 'я', ye: 'е' };
const LAT2CYR_ONE = {
  a: 'а', b: 'б', c: 'с', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к',
  l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у',
  v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
};

function isUpper(ch) { return ch !== ch.toLowerCase() && ch === ch.toUpperCase(); }
function matchCase(cyr, latinFirst) { return isUpper(latinFirst) ? cyr.toUpperCase() : cyr; }

// Lotin -> kirill (taxminiy, lekin o'qishli)
function latToCyr(str) {
  str = (str || "").replace(/[ʻ’‘`´ʼ]/g, "'");
  str = str.replace(/([oO])'/g, (m, p) => (p === 'O' ? 'Ў' : 'ў'));
  str = str.replace(/([gG])'/g, (m, p) => (p === 'G' ? 'Ғ' : 'ғ'));
  let out = "", i = 0;
  const n = str.length;
  while (i < n) {
    const ch = str[i];
    const two = str.substr(i, 2).toLowerCase();
    const low = ch.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LAT2CYR_DI, two)) {
      out += matchCase(LAT2CYR_DI[two], ch); i += 2; continue;
    }
    if (low === 'e') {
      const prev = i > 0 ? str[i - 1] : '';
      const initial = (i === 0) || !/\p{L}/u.test(prev);
      out += matchCase(initial ? 'э' : 'е', ch); i += 1; continue;
    }
    if (Object.prototype.hasOwnProperty.call(LAT2CYR_ONE, low)) {
      out += matchCase(LAT2CYR_ONE[low], ch); i += 1; continue;
    }
    if (ch === "'") { out += 'ъ'; i += 1; continue; }
    out += ch; i += 1;
  }
  return out;
}

// ----- Savol obyektidan o'qish -----
function qLat(q) { return (q.uz_lotin || {}).savol || ""; }
function qCyr(q) { return (q.uz_kirill || {}).savol || ""; }
function qVars(q) { return (q.uz_lotin || {}).variantlar || []; }

// ====================================================================
//  Yordamchilar
// ====================================================================

function imgSrc(p) { return /^https?:\/\//i.test(p) ? p : "/" + p; }
function truncate(s, n) { s = s || ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function toast(msg, isError) {
  const t = document.createElement("div");
  t.className = "toast " + (isError ? "err" : "ok");
  t.textContent = msg;
  el.toasts.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3200);
}

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (_) { /* JSON emas */ }
  if (!res.ok) { const e = new Error((data && data.error) || ("Xatolik (" + res.status + ")")); e.data = data; throw e; }
  return data;
}

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Faylni o'qib bo'lmadi."));
    r.readAsDataURL(file);
  });
}
async function uploadFile(file) {
  if (!file.type.startsWith("image/")) throw new Error("Faqat rasm fayli tanlang.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Rasm hajmi 10 MB dan oshmasligi kerak.");
  const data = await readDataUrl(file);
  return (await api("POST", "/api/upload", { filename: file.name, data })).path;
}
function cleanupUploaded(path) {
  if (!path) return;
  api("DELETE", "/api/images/" + encodeURIComponent(path.split("/").pop())).catch(() => {});
}

function imagePreview(path, onRemove) {
  const wrap = document.createElement("div");
  wrap.className = "img-prev";
  const img = document.createElement("img");
  img.src = imgSrc(path); img.alt = "";
  const rm = document.createElement("button");
  rm.type = "button"; rm.className = "img-rm"; rm.title = "Rasmni o'chirish"; rm.textContent = "✕";
  rm.addEventListener("click", onRemove);
  wrap.append(img, rm);
  return wrap;
}

// ====================================================================
//  Yuklash va ro'yxat
// ====================================================================

async function loadQuestions() {
  const db = await api("GET", "/api/questions");
  questions = Array.isArray(db.savollar) ? db.savollar : [];
  el.stats.textContent = "Jami savollar: " + questions.length;
  renderList(el.search.value);
  checkDuplicate();
}

function renderList(filter) {
  const f = dupKey(filter || "");
  let items = questions;
  if (f) {
    items = questions.filter((q) => {
      const hay = dupKey(
        qLat(q) + " " + qCyr(q) + " " + ((q.rus || {}).savol || "") + " " +
        qVars(q).map((v) => v.matn).join(" ") + " " +
        ((q.uz_kirill || {}).variantlar || []).map((v) => v.matn).join(" ") + " " +
        ((q.rus || {}).variantlar || []).map((v) => v.matn).join(" ")
      );
      return hay.includes(f);
    });
  }
  el.list.innerHTML = "";
  if (items.length === 0) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = questions.length === 0
      ? "Hozircha savollar yo'q. Chap tomondan birinchi savolni qo'shing 👈"
      : "Qidiruv bo'yicha hech narsa topilmadi.";
    el.list.appendChild(div);
    return;
  }
  items.forEach((q) => {
    const idx = questions.indexOf(q) + 1;
    const correct = qVars(q).map((v, i) => (v.togri ? String.fromCharCode(65 + i) : null)).filter(Boolean).join(", ");
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML =
      '<div class="card-top">' +
        '<span class="card-num">#' + idx + "</span>" +
        (q.rasm ? '<img class="card-thumb" loading="lazy" src="' + imgSrc(q.rasm) + '" alt="">' : "") +
        '<div class="card-text"></div>' +
      "</div>" +
      '<div class="card-meta">' +
        "<span>📋 " + qVars(q).length + " variant</span>" +
        (correct ? '<span class="ok-badge">✔️ To\'g\'ri: ' + correct + "</span>"
                 : '<span class="warn-badge">to\'g\'ri javob yo\'q</span>') +
        (q.rasm ? "<span>🖼️ rasm</span>" : "") +
      "</div>" +
      '<div class="card-actions">' +
        '<button class="btn small edit-btn" type="button">✏️ Tahrirlash</button>' +
        '<button class="btn small danger del-btn" type="button">🗑️ O\'chirish</button>' +
      "</div>";
    card.querySelector(".card-text").textContent = qLat(q);
    card.querySelector(".edit-btn").addEventListener("click", () => startEdit(q.id));
    card.querySelector(".del-btn").addEventListener("click", () => removeQuestion(q.id));
    el.list.appendChild(card);
  });
}

// ====================================================================
//  Forma
// ====================================================================

function startNew() {
  editingId = null;
  form = emptyForm();
  el.qtextLat.value = "";
  el.qtextCyr.value = "";
  el.qtextRus.value = "";
  el.formTitle.textContent = "Yangi savol qo'shish";
  el.cancelBtn.hidden = true;
  el.newBtn.hidden = true;
  renderQuestionImage();
  renderOptions();
  setLocked(true);
  checkDuplicate();
  el.qtextLat.focus();
}

function startEdit(id) {
  const q = questions.find((x) => x.id === id);
  if (!q) return;
  editingId = id;
  const kv = (q.uz_kirill || {}).variantlar || [];
  const rv = (q.rus || {}).variantlar || [];
  form = {
    rasm: q.rasm || null,
    savol_lotin: qLat(q),
    savol_kirill: qCyr(q),
    savol_kirill_touched: true,
    savol_rus: (q.rus || {}).savol || "",
    savol_rus_touched: true,
    variantlar: qVars(q).map((v, i) => ({
      matn_lotin: v.matn || "",
      matn_kirill: (kv[i] || {}).matn || "",
      matn_kirill_touched: true,
      matn_rus: (rv[i] || {}).matn || "",
      matn_rus_touched: true,
      rasm: v.rasm || null,
      togri: !!v.togri,
    })),
  };
  while (form.variantlar.length < 2) form.variantlar.push(blankOption());
  el.qtextLat.value = form.savol_lotin;
  el.qtextCyr.value = form.savol_kirill;
  el.qtextRus.value = form.savol_rus;
  el.formTitle.textContent = "✏️ Savolni tahrirlash";
  el.cancelBtn.hidden = false;
  el.newBtn.hidden = false;
  renderQuestionImage();
  renderOptions();
  setLocked(false);
  checkDuplicate();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLocked(locked) {
  el.details.disabled = locked;
  el.lockOverlay.style.display = locked ? "flex" : "none";
}

function checkDuplicate() {
  const text = el.qtextLat.value.trim();
  form.savol_lotin = text;
  const key = dupKey(text);
  if (!key) {
    el.dupStatus.className = "dup-status";
    el.dupStatus.textContent = "";
    el.saveBtn.disabled = true;
    if (!editingId) setLocked(true);
    return;
  }
  const dup = questions.find((q) => q.id !== editingId && dupKey(qLat(q)) === key);
  if (dup) {
    el.dupStatus.className = "dup-status bad";
    el.dupStatus.textContent = "✗ Bunday savol bazada bor: «" + truncate(qLat(dup), 80) + "»";
    el.saveBtn.disabled = true;
    if (!editingId) setLocked(true);
  } else {
    el.dupStatus.className = "dup-status good";
    el.dupStatus.textContent = editingId
      ? "✓ Matn band emas."
      : "✓ Yangi savol — quyida variant va rasm qo'shishingiz mumkin.";
    el.saveBtn.disabled = false;
    setLocked(false);
  }
}

function renderQuestionImage() {
  el.qImagePreview.innerHTML = "";
  if (form.rasm) {
    el.qImagePreview.appendChild(imagePreview(form.rasm, () => {
      cleanupUploaded(form.rasm); form.rasm = null; renderQuestionImage();
    }));
    el.qImageBtn.textContent = "🖼️ Rasmni almashtirish";
  } else {
    el.qImageBtn.textContent = "🖼️ Rasm tanlash";
  }
}

function renderOptions() {
  el.options.innerHTML = "";
  form.variantlar.forEach((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    const row = document.createElement("div");
    row.className = "option-row";
    row.innerHTML =
      '<label class="correct-check" title="To\'g\'ri javob">' +
        '<input type="checkbox" class="opt-correct"><span class="letter">' + letter + "</span>" +
      "</label>" +
      '<div class="opt-main">' +
        '<input type="text" class="opt-text opt-lat" placeholder="' + letter + ' variant — lotin">' +
        '<input type="text" class="opt-text cyr opt-cyr" placeholder="' + letter + ' variant — kirill (avtomatik)">' +
        '<input type="text" class="opt-text rus opt-rus" placeholder="' + letter + ' variant — rus (tarjima)">' +
        '<div class="opt-image-wrap"></div>' +
      "</div>" +
      '<button class="btn icon opt-img-btn" type="button" title="Rasm qo\'shish">🖼️</button>' +
      '<button class="btn icon danger opt-del" type="button" title="Variantni o\'chirish">✕</button>' +
      '<input type="file" accept="image/*" class="opt-file" hidden>';

    const cb = row.querySelector(".opt-correct");
    cb.checked = opt.togri;
    cb.addEventListener("change", () => { form.variantlar[i].togri = cb.checked; });

    const lat = row.querySelector(".opt-lat");
    const cyr = row.querySelector(".opt-cyr");
    lat.value = opt.matn_lotin;
    cyr.value = opt.matn_kirill;
    lat.addEventListener("input", () => {
      form.variantlar[i].matn_lotin = lat.value;
      if (!form.variantlar[i].matn_kirill_touched) {
        form.variantlar[i].matn_kirill = latToCyr(lat.value);
        cyr.value = form.variantlar[i].matn_kirill;
      }
      scheduleAutoTranslate("v" + i);
    });
    cyr.addEventListener("input", () => {
      form.variantlar[i].matn_kirill = cyr.value;
      form.variantlar[i].matn_kirill_touched = cyr.value.trim().length > 0;
    });

    const rus = row.querySelector(".opt-rus");
    rus.value = opt.matn_rus;
    rus.addEventListener("input", () => {
      form.variantlar[i].matn_rus = rus.value;
      form.variantlar[i].matn_rus_touched = rus.value.trim().length > 0;
    });

    row.querySelector(".opt-del").addEventListener("click", () => {
      if (form.variantlar.length <= 2) { toast("Kamida 2 ta variant bo'lishi kerak.", true); return; }
      if (form.variantlar[i].rasm) cleanupUploaded(form.variantlar[i].rasm);
      form.variantlar.splice(i, 1);
      renderOptions();
    });

    const file = row.querySelector(".opt-file");
    row.querySelector(".opt-img-btn").addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        const path = await uploadFile(f);
        if (form.variantlar[i].rasm) cleanupUploaded(form.variantlar[i].rasm);
        form.variantlar[i].rasm = path;
        renderOptions();
      } catch (e) { toast(e.message, true); }
    });

    if (opt.rasm) {
      row.querySelector(".opt-image-wrap").appendChild(imagePreview(opt.rasm, () => {
        cleanupUploaded(form.variantlar[i].rasm);
        form.variantlar[i].rasm = null;
        renderOptions();
      }));
    }
    el.options.appendChild(row);
  });
}

// ====================================================================
//  Saqlash / o'chirish / yuklab olish
// ====================================================================

async function save() {
  const text = el.qtextLat.value.trim();
  if (!text) { toast("Savol matni (lotin) bo'sh bo'lmasligi kerak.", true); return; }
  const key = dupKey(text);
  const dup = questions.find((q) => q.id !== editingId && dupKey(qLat(q)) === key);
  if (dup) { toast("Bu savol bazada allaqachon mavjud.", true); return; }

  const variantlar = form.variantlar
    .map((v) => ({
      matn_lotin: (v.matn_lotin || "").trim(),
      matn_kirill: (v.matn_kirill || "").trim(),
      matn_rus: (v.matn_rus || "").trim(),
      rasm: v.rasm || null,
      togri: !!v.togri,
    }))
    .filter((v) => v.matn_lotin || v.rasm);
  if (variantlar.length < 2) { toast("Kamida 2 ta variant kiriting.", true); return; }
  if (!variantlar.some((v) => v.togri)) { toast("Kamida bitta to'g'ri javobni belgilang.", true); return; }

  const payload = {
    rasm: form.rasm || null,
    savol_lotin: text,
    savol_kirill: el.qtextCyr.value.trim() || latToCyr(text),
    savol_rus: el.qtextRus.value.trim(),
    variantlar,
  };
  el.saveBtn.disabled = true;
  try {
    if (editingId) { await api("PUT", "/api/questions/" + editingId, payload); toast("✓ Savol tahrirlandi.", false); }
    else { await api("POST", "/api/questions", payload); toast("✓ Yangi savol qo'shildi.", false); }
    await loadQuestions();
    startNew();
  } catch (e) { toast(e.message, true); el.saveBtn.disabled = false; }
}

async function removeQuestion(id) {
  const q = questions.find((x) => x.id === id);
  if (!q) return;
  if (!confirm("Ushbu savolni o'chirishni tasdiqlaysizmi?\n\n«" + truncate(qLat(q), 120) + "»")) return;
  try {
    await api("DELETE", "/api/questions/" + id);
    toast("Savol o'chirildi.", false);
    if (editingId === id) startNew();
    await loadQuestions();
  } catch (e) { toast(e.message, true); }
}

async function downloadJson() {
  try {
    const db = await api("GET", "/api/questions");
    const count = (db.savollar || []).length;
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const a = document.createElement("a");
    a.href = url; a.download = "savollar_" + stamp + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("✓ JSON yuklab olindi (" + count + " savol).", false);
  } catch (e) { toast("Yuklab bo'lmadi: " + e.message, true); }
}

// Savollar + barcha rasmlarni bitta ZIP fayl qilib yuklab olish
function downloadBackup() {
  toast("📦 Zaxira tayyorlanmoqda (rasmlar bilan) — biroz kuting...", false);
  const a = document.createElement("a");
  a.href = "/api/backup";   // server ZIP ni Content-Disposition bilan beradi
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ====================================================================
//  Hodisalar va ishga tushirish
// ====================================================================

function regenerateCyrillic() {
  form.savol_kirill = latToCyr(form.savol_lotin);
  form.savol_kirill_touched = false;
  el.qtextCyr.value = form.savol_kirill;
  form.variantlar.forEach((v) => { v.matn_kirill = latToCyr(v.matn_lotin); v.matn_kirill_touched = false; });
  renderOptions();
  toast("Kirillcha lotindan yangilandi.", false);
}

// Savol va variantlarni rus tiliga tarjima qilish (server orqali, onlayn)
async function translateAll() {
  const text = el.qtextLat.value.trim();
  if (!text) { toast("Avval savolni lotinda yozing.", true); return; }
  const texts = [text, ...form.variantlar.map((v) => v.matn_lotin || "")];
  el.translateBtn.disabled = true;
  const label = el.translateBtn.textContent;
  el.translateBtn.textContent = "⏳ Tarjima...";
  try {
    const res = await api("POST", "/api/translate", { texts });
    const tr = res.translations || [];
    if (!res.ok && !tr.some((t) => t)) {
      toast("Tarjima bo'lmadi — internet borligini tekshiring.", true);
      return;
    }
    form.savol_rus = tr[0] || "";
    form.savol_rus_touched = false;
    el.qtextRus.value = form.savol_rus;
    form.variantlar.forEach((v, i) => { v.matn_rus = tr[i + 1] || ""; v.matn_rus_touched = false; });
    renderOptions();
    toast("✓ Rus tiliga tarjima qilindi. Tekshirib oling.", false);
  } catch (e) {
    toast("Tarjima xatosi: " + e.message, true);
  } finally {
    el.translateBtn.disabled = false;
    el.translateBtn.textContent = label;
  }
}

// --- Avtomatik rus tarjimasi: yozishdan to'xtagach, tugmasiz ---
let autoTrTimer = null;
const autoTrDirty = new Set();
let autoTrWarned = false;

function scheduleAutoTranslate(key) {
  autoTrDirty.add(key);
  clearTimeout(autoTrTimer);
  autoTrTimer = setTimeout(flushAutoTranslate, 900);
}

async function flushAutoTranslate() {
  // Faqat o'zgargan, qo'lda tahrirlanmagan va bo'sh bo'lmagan maydonlarni tarjima qilamiz
  const jobs = [];
  autoTrDirty.forEach((key) => {
    if (key === "q") {
      if (!form.savol_rus_touched && form.savol_lotin.trim()) jobs.push({ key, text: form.savol_lotin.trim() });
    } else {
      const i = parseInt(key.slice(1), 10);
      const v = form.variantlar[i];
      if (v && !v.matn_rus_touched && (v.matn_lotin || "").trim()) jobs.push({ key, text: v.matn_lotin.trim() });
    }
  });
  autoTrDirty.clear();
  if (!jobs.length) return;

  let res;
  try {
    res = await api("POST", "/api/translate", { texts: jobs.map((j) => j.text) });
  } catch (e) { return; }  // internet yo'q — jim
  const tr = (res && res.translations) || [];
  if (!tr.some((t) => t)) {
    if (!autoTrWarned) {
      autoTrWarned = true;
      toast("Avto-tarjima uchun internet kerak (rus tilini qo'lda ham yozsa bo'ladi).", true);
    }
    return;
  }
  jobs.forEach((j, idx) => {
    const ru = tr[idx] || "";
    if (!ru) return;
    if (j.key === "q") {
      if (form.savol_rus_touched || form.savol_lotin.trim() !== j.text) return;  // o'zgarib ketgan bo'lsa
      form.savol_rus = ru;
      el.qtextRus.value = ru;
    } else {
      const i = parseInt(j.key.slice(1), 10);
      const v = form.variantlar[i];
      if (!v || v.matn_rus_touched || (v.matn_lotin || "").trim() !== j.text) return;
      v.matn_rus = ru;
      const row = el.options.children[i];
      if (row) { const inp = row.querySelector(".opt-rus"); if (inp) inp.value = ru; }
    }
  });
}

function bindEvents() {
  let dupTimer = null;
  el.qtextLat.addEventListener("input", () => {
    form.savol_lotin = el.qtextLat.value;
    if (!form.savol_kirill_touched) {
      form.savol_kirill = latToCyr(el.qtextLat.value);
      el.qtextCyr.value = form.savol_kirill;
    }
    clearTimeout(dupTimer);
    dupTimer = setTimeout(checkDuplicate, 220);
    scheduleAutoTranslate("q");
  });
  el.qtextCyr.addEventListener("input", () => {
    form.savol_kirill = el.qtextCyr.value;
    form.savol_kirill_touched = el.qtextCyr.value.trim().length > 0;
  });
  el.qtextRus.addEventListener("input", () => {
    form.savol_rus = el.qtextRus.value;
    form.savol_rus_touched = el.qtextRus.value.trim().length > 0;
  });
  el.regenBtn.addEventListener("click", regenerateCyrillic);
  el.translateBtn.addEventListener("click", translateAll);

  el.addOptBtn.addEventListener("click", () => {
    if (form.variantlar.length >= 8) { toast("Ko'pi bilan 8 ta variant.", true); return; }
    form.variantlar.push(blankOption());
    renderOptions();
  });

  el.qImageBtn.addEventListener("click", () => el.qImageInput.click());
  el.qImageInput.addEventListener("change", async () => {
    const f = el.qImageInput.files[0];
    if (!f) return;
    try {
      const path = await uploadFile(f);
      if (form.rasm) cleanupUploaded(form.rasm);
      form.rasm = path;
      renderQuestionImage();
    } catch (e) { toast(e.message, true); }
    el.qImageInput.value = "";
  });

  el.saveBtn.addEventListener("click", save);
  el.cancelBtn.addEventListener("click", startNew);
  el.newBtn.addEventListener("click", startNew);
  el.downloadBtn.addEventListener("click", downloadJson);
  el.backupBtn.addEventListener("click", downloadBackup);
  el.search.addEventListener("input", () => renderList(el.search.value));
}

function showServerError() {
  document.body.innerHTML =
    '<div style="max-width:580px;margin:70px auto;padding:32px;font-family:Segoe UI,system-ui,sans-serif;' +
    'background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,.1);text-align:center">' +
    '<div style="font-size:48px">🔌</div>' +
    '<h2 style="color:#dc2626;margin:10px 0">Server bilan aloqa yo\'q</h2>' +
    '<p style="color:#334155;line-height:1.6;font-size:15px">Bu dasturni <b>start.bat</b> orqali oching.<br>' +
    '<b>index.html</b> faylini to\'g\'ridan-to\'g\'ri (ustiga bosib) ochmang.</p>' +
    '<ol style="text-align:left;color:#334155;line-height:1.9;display:inline-block;margin:6px auto;font-size:15px">' +
    '<li>Papkadagi <b>start.bat</b> ni ikki marta bosing</li>' +
    '<li>Ochilgan qora oyna <b>yopilmasin</b></li>' +
    '<li>Brauzer o\'zi ochiladi (yoki <b>http://127.0.0.1:8000</b> manziliga kiring)</li>' +
    '</ol></div>';
}

async function init() {
  grab();
  bindEvents();
  startNew();
  try { await loadQuestions(); }
  catch (e) { showServerError(); }
}

document.addEventListener("DOMContentLoaded", init);
