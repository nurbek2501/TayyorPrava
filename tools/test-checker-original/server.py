#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test savollari bazasi — lokal server (faqat Python standart kutubxonasi).

Saqlash formati (oldingi test fayli ko'rinishida):
  {
    "manba": ..., "jami_savollar": N, "rasmli_savollar": M,
    "savollar": [
      {
        "id": ..., "raqam": 1, "rasm": "images/..."|null,
        "uz_lotin":  {"savol": "...", "variantlar": [{"matn":"...","togri":true,"rasm":...}]},
        "uz_kirill": {"savol": "...", "variantlar": [{"matn":"...","togri":true,"rasm":...}]},
        "createdAt": ..., "updatedAt": ...
      }
    ]
  }

Takror tekshiruvi lotin/kirildan qat'i nazar ishlaydi: matn lotinga o'girilib,
faqat harf/raqam bo'yicha solishtiriladi. Shu sabab "Svetofor" va "Светофор" bir xil.
"""

import os
import re
import io
import sys
import json
import time
import base64
import zipfile
import secrets
import threading
import mimetypes
import webbrowser
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote, quote

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "questions.json")
IMAGES_DIR = os.path.join(BASE_DIR, "images")

ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

mimetypes.add_type("image/webp", ".webp")

# ============================================================================
#  Transliteratsiya (lotin <-> kirill)
# ============================================================================

# Kirill -> lotin (takror tekshiruvi uchun; kichik harfda, apostrofsiz)
_CYR2LAT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'ў': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'x', 'ҳ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
    'ъ': '', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ы': 'i',
}

# Lotin -> kirill
_LAT2CYR_DI = {  # ikki harfli birikmalar
    'sh': 'ш', 'ch': 'ч', 'yo': 'ё', 'yu': 'ю', 'ya': 'я', 'ye': 'е',
}
_LAT2CYR_ONE = {
    'a': 'а', 'b': 'б', 'c': 'с', 'd': 'д', 'f': 'ф', 'g': 'г', 'h': 'ҳ', 'i': 'и',
    'j': 'ж', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п', 'q': 'қ',
    'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'v': 'в', 'w': 'в', 'x': 'х', 'y': 'й',
    'z': 'з',
}


def _norm_apostrophes(s):
    for ch in "ʻ’‘`´ʼ":
        s = s.replace(ch, "'")
    return s


def _match_case(cyr, latin_first):
    """cyr (bir harf) ni latin harf registriga moslaydi."""
    return cyr.upper() if latin_first.isupper() else cyr


def translit_lat_to_cyr(s):
    """O'zbek lotin matnini kirillga o'giradi (taxminiy, lekin o'qishli)."""
    s = _norm_apostrophes(s or "")
    # Avval o'/g' -> ў/ғ (digraf qoidalaridan oldin)
    s = re.sub(r"[oO]'", lambda m: 'Ў' if m.group(0)[0] == 'O' else 'ў', s)
    s = re.sub(r"[gG]'", lambda m: 'Ғ' if m.group(0)[0] == 'G' else 'ғ', s)

    out = []
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        two = s[i:i + 2].lower()
        low = ch.lower()
        if two in _LAT2CYR_DI:
            out.append(_match_case(_LAT2CYR_DI[two], ch))
            i += 2
            continue
        if low == 'e':
            prev = s[i - 1] if i > 0 else ''
            initial = (i == 0) or (not prev.isalpha())
            out.append(_match_case('э' if initial else 'е', ch))
            i += 1
            continue
        if low in _LAT2CYR_ONE:
            out.append(_match_case(_LAT2CYR_ONE[low], ch))
            i += 1
            continue
        if ch == "'":
            out.append('ъ')   # tutuq belgisi
            i += 1
            continue
        out.append(ch)        # raqam, probel, tinish belgisi va h.k.
        i += 1
    return "".join(out)


def dup_key(s):
    """Takror tekshiruvi uchun kalit: kirilni lotinga o'girib, faqat harf/raqam qoldiradi."""
    s = (s or "").lower()
    s = "".join(_CYR2LAT.get(c, c) for c in s)
    return re.sub(r"[\W_]+", "", s, flags=re.UNICODE)


def translate_uz_to_ru(text):
    """O'zbek (lotin) matnini rus tiliga o'giradi (onlayn — internet kerak).
    Bo'sh matn -> bo'sh. O'gira olmasa (internet yo'q) Exception ko'taradi."""
    text = (text or "").strip()
    if not text:
        return ""
    url = ("https://translate.googleapis.com/translate_a/single"
           "?client=gtx&sl=uz&tl=ru&dt=t&q=" + quote(text))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode("utf-8"))
    return "".join(seg[0] for seg in data[0] if seg and seg[0])


# ============================================================================
#  Baza (JSON) bilan ishlash
# ============================================================================

def _empty_db():
    return {"manba": "avtotestu.uz + qo'lda kiritilgan",
            "jami_savollar": 0, "rasmli_savollar": 0, "savollar": []}


# Baza xotirada saqlanadi (kesh) — har so'rovda diskni o'qimaymiz.
# Bu OneDrive/antivirus bilan fayl ustida ziddiyatni keskin kamaytiradi.
_DB_LOCK = threading.RLock()
_DB_CACHE = None


def _read_db_from_disk():
    """Diskdan o'qiydi. OneDrive faylni "faqat bulutda" qilib qo'yishi yoki qulflashi
    mumkin — shu sabab faylni TO'LIQ o'qib (yuklanishga majburlab), bir necha marta urinadi.

    MUHIM: hech qanday holatda faylni O'CHIRMAYDI yoki qayta nomlamaydi. O'qib bo'lmasa,
    xato chiqaradi — fayl joyida butun qoladi (ma'lumot hech qachon yo'qolmaydi).
    Yozish atomik (.tmp -> almashtirish) bo'lgani uchun fayl chala qolmaydi."""
    if not os.path.exists(DB_PATH):
        return _empty_db()
    last = None
    for _ in range(20):
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            if content.strip() == "":
                raise ValueError("fayl bo'sh o'qildi (OneDrive yuklayotgan bo'lishi mumkin)")
            data = json.loads(content)
            if not isinstance(data, dict) or not isinstance(data.get("savollar"), list):
                raise ValueError("struktura xato")
            return data
        except (OSError, json.JSONDecodeError, ValueError) as e:
            last = e
            time.sleep(0.3)  # OneDrive faylni tayyorlashi uchun kutamiz
    raise RuntimeError(f"questions.json o'qib bo'lmadi (OneDrive faylni yuklay olmadi?): {last}")


def load_db():
    """Keshdagi bazani qaytaradi (birinchi marta diskdan o'qiydi)."""
    global _DB_CACHE
    with _DB_LOCK:
        if _DB_CACHE is None:
            _DB_CACHE = _read_db_from_disk()
        return _DB_CACHE


def save_db(db):
    """Bazani diskka atomik yozadi va keshni yangilaydi. Band bo'lsa qayta urinadi."""
    global _DB_CACHE
    with _DB_LOCK:
        db["jami_savollar"] = len(db["savollar"])
        db["rasmli_savollar"] = sum(1 for q in db["savollar"] if q.get("rasm"))
        for i, q in enumerate(db["savollar"], 1):
            q["raqam"] = i
        payload = json.dumps(db, ensure_ascii=False, indent=2)
        tmp = DB_PATH + ".tmp"
        last = None
        for _ in range(6):
            try:
                with open(tmp, "w", encoding="utf-8") as f:
                    f.write(payload)
                os.replace(tmp, DB_PATH)
                _DB_CACHE = db
                return
            except OSError as e:
                last = e
                time.sleep(0.2)
        _DB_CACHE = db  # kamida xotirada saqlab qolamiz
        raise RuntimeError(f"questions.json saqlab bo'lmadi (fayl band): {last}")


def dump_db_bytes():
    """Bazani JSON baytlarga aylantiradi — qulf ostida (ko'p kishi bir vaqtda ishlatsa xavfsiz)."""
    with _DB_LOCK:
        return json.dumps(load_db(), ensure_ascii=False).encode("utf-8")


def find_duplicate(db, savol_lotin, exclude_id=None):
    key = dup_key(savol_lotin)
    if not key:
        return None
    for q in db["savollar"]:
        if exclude_id and q.get("id") == exclude_id:
            continue
        if dup_key((q.get("uz_lotin") or {}).get("savol", "")) == key:
            return q
    return None


# ============================================================================
#  Yordamchilar
# ============================================================================

def new_id():
    return f"q_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(3)}"


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def build_question(payload, qid=None, created=None):
    """Frontend payload'idan savol obyektini quradi. Xato bo'lsa (obyekt, xato) qaytaradi."""
    savol_lotin = (payload.get("savol_lotin") or "").strip()
    if not savol_lotin:
        return None, "Savol matni (lotin) bo'sh bo'lmasligi kerak."
    savol_kirill = (payload.get("savol_kirill") or "").strip() or translit_lat_to_cyr(savol_lotin)
    savol_rus = (payload.get("savol_rus") or "").strip()

    lot_vars, kir_vars, rus_vars = [], [], []
    for v in payload.get("variantlar", []):
        if not isinstance(v, dict):
            continue
        ml = (v.get("matn_lotin") or "").strip()
        img = v.get("rasm") or None
        if not ml and not img:
            continue
        mk = (v.get("matn_kirill") or "").strip() or (translit_lat_to_cyr(ml) if ml else "")
        mr = (v.get("matn_rus") or "").strip()
        togri = bool(v.get("togri"))
        lv = {"matn": ml, "togri": togri}
        kv = {"matn": mk, "togri": togri}
        rv = {"matn": mr, "togri": togri}
        if img:
            lv["rasm"] = img
            kv["rasm"] = img
            rv["rasm"] = img
        lot_vars.append(lv)
        kir_vars.append(kv)
        rus_vars.append(rv)

    if len(lot_vars) < 2:
        return None, "Kamida 2 ta variant kiritilishi kerak."
    if not any(v["togri"] for v in lot_vars):
        return None, "Kamida bitta to'g'ri javob belgilanishi kerak."

    return {
        "id": qid or new_id(),
        "rasm": payload.get("rasm") or None,
        "uz_lotin": {"savol": savol_lotin, "variantlar": lot_vars},
        "uz_kirill": {"savol": savol_kirill, "variantlar": kir_vars},
        "rus": {"savol": savol_rus, "variantlar": rus_vars},
        "createdAt": created or now_iso(),
        "updatedAt": now_iso(),
    }, None


def question_image_names(q):
    names = set()
    if q.get("rasm"):
        names.add(os.path.basename(q["rasm"]))
    for blok in ("uz_lotin", "uz_kirill", "rus"):
        for v in (q.get(blok) or {}).get("variantlar", []):
            if v.get("rasm"):
                names.add(os.path.basename(v["rasm"]))
    return names


def all_used_image_names(db):
    names = set()
    for q in db["savollar"]:
        names |= question_image_names(q)
    return names


def delete_images(names, db):
    """Faqat dastur yuklagan (img_ bilan boshlanuvchi) va boshqa joyda ishlatilmayotgan rasmlarni o'chiradi."""
    used = all_used_image_names(db)
    for name in names:
        if not name.startswith("img_") or name in used:
            continue
        path = os.path.join(IMAGES_DIR, name)
        try:
            if os.path.isfile(path):
                os.remove(path)
        except OSError:
            pass


def make_backup_zip():
    """questions.json + barcha rasmlarni bitta ZIP faylga jamlaydi (xotirada)."""
    buf = io.BytesIO()
    with _DB_LOCK:
        db_json = json.dumps(load_db(), ensure_ascii=False, indent=2)
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("questions.json", db_json, compress_type=zipfile.ZIP_DEFLATED)
        if os.path.isdir(IMAGES_DIR):
            for name in sorted(os.listdir(IMAGES_DIR)):
                p = os.path.join(IMAGES_DIR, name)
                if not os.path.isfile(p):
                    continue
                try:
                    # rasmlar allaqachon siqilgan (webp/png) — qayta siqmaymiz (tezroq)
                    z.write(p, f"images/{name}", compress_type=zipfile.ZIP_STORED)
                except OSError:
                    pass  # bitta rasm o'qilmasa, qolganini davom ettiramiz
    return buf.getvalue()


# ============================================================================
#  HTTP
# ============================================================================

class Handler(BaseHTTPRequestHandler):

    def send_json(self, obj, status=200):
        self.send_json_raw(json.dumps(obj, ensure_ascii=False).encode("utf-8"), status)

    def send_json_raw(self, body, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_static(self, path, content_type):
        if not os.path.isfile(path):
            self.send_json({"error": "Fayl topilmadi."}, 404)
            return
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def log_message(self, fmt, *args):
        print(f"  {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    # ---- GET ----
    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self.send_static(os.path.join(BASE_DIR, "index.html"), "text/html; charset=utf-8")
        elif path == "/app.js":
            self.send_static(os.path.join(BASE_DIR, "app.js"), "application/javascript; charset=utf-8")
        elif path == "/style.css":
            self.send_static(os.path.join(BASE_DIR, "style.css"), "text/css; charset=utf-8")
        elif path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        elif path == "/api/questions":
            self.send_json_raw(dump_db_bytes())
        elif path == "/api/backup":
            data = make_backup_zip()
            stamp = datetime.now().strftime("%Y-%m-%d")
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f'attachment; filename="savollar_backup_{stamp}.zip"')
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        elif path == "/api/translit":
            # jonli lotin->kirill o'girish (zaxira, frontend o'zi ham qiladi)
            from urllib.parse import parse_qs
            q = parse_qs(urlparse(self.path).query).get("t", [""])[0]
            self.send_json({"kirill": translit_lat_to_cyr(q)})
        elif path.startswith("/images/"):
            name = os.path.basename(unquote(path))
            ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
            self.send_static(os.path.join(IMAGES_DIR, name), ctype)
        else:
            self.send_json({"error": "Topilmadi."}, 404)

    # ---- POST ----
    def do_POST(self):
        path = urlparse(self.path).path
        try:
            if path == "/api/questions":
                self.add_question()
            elif path == "/api/upload":
                self.upload_image()
            elif path == "/api/translate":
                self.translate_texts()
            else:
                self.send_json({"error": "Topilmadi."}, 404)
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "So'rov ma'lumoti noto'g'ri."}, 400)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": f"Server xatosi: {e}"}, 500)

    def add_question(self):
        payload = self.read_json_body()
        with _DB_LOCK:
            db = load_db()
            dup = find_duplicate(db, payload.get("savol_lotin", ""))
            if dup:
                status, resp = 409, {"error": "Bu savol bazada allaqachon mavjud.", "duplicate": dup}
            else:
                q, err = build_question(payload)
                if err:
                    status, resp = 400, {"error": err}
                else:
                    db["savollar"].append(q)
                    save_db(db)
                    status, resp = 201, {"ok": True, "question": q}
        self.send_json(resp, status)

    def upload_image(self):
        payload = self.read_json_body()
        data_url = payload.get("data") or ""
        orig = payload.get("filename") or "image"
        m = re.match(r"^data:([\w/+.\-]+);base64,(.*)$", data_url, re.DOTALL)
        if not m:
            self.send_json({"error": "Rasm ma'lumoti noto'g'ri."}, 400)
            return
        mime, b64 = m.group(1), m.group(2)
        try:
            raw = base64.b64decode(b64)
        except Exception:  # noqa: BLE001
            self.send_json({"error": "Rasmni o'qib bo'lmadi."}, 400)
            return
        if len(raw) > MAX_IMAGE_BYTES:
            self.send_json({"error": "Rasm hajmi 10 MB dan oshmasligi kerak."}, 400)
            return
        ext = os.path.splitext(orig)[1].lower()
        if ext not in ALLOWED_IMAGE_EXT:
            ext = mimetypes.guess_extension(mime) or ".png"
            if ext == ".jpe":
                ext = ".jpg"
        if ext not in ALLOWED_IMAGE_EXT:
            self.send_json({"error": "Bu rasm formati qo'llab-quvvatlanmaydi."}, 400)
            return
        os.makedirs(IMAGES_DIR, exist_ok=True)
        name = f"img_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(4)}{ext}"
        with open(os.path.join(IMAGES_DIR, name), "wb") as f:
            f.write(raw)
        self.send_json({"ok": True, "path": f"images/{name}"}, 201)

    def translate_texts(self):
        """Bir nechta matnni uz->ru tarjima qiladi. Internet yo'q bo'lsa bo'sh qaytaradi."""
        payload = self.read_json_body()
        texts = payload.get("texts") or []
        out, offline = [], False
        for t in texts:
            if offline:
                out.append("")
                continue
            try:
                out.append(translate_uz_to_ru(t))
            except Exception:  # noqa: BLE001 — internet yo'q yoki xizmat ishlamadi
                out.append("")
                offline = True  # birinchi xatodan keyin urinmaymiz
        self.send_json({"ok": not offline, "translations": out})

    # ---- PUT ----
    def do_PUT(self):
        m = re.match(r"^/api/questions/([\w\-]+)$", urlparse(self.path).path)
        if not m:
            self.send_json({"error": "Topilmadi."}, 404)
            return
        qid = m.group(1)
        try:
            payload = self.read_json_body()
            with _DB_LOCK:
                db = load_db()
                idx = next((i for i, q in enumerate(db["savollar"]) if q["id"] == qid), None)
                if idx is None:
                    status, resp = 404, {"error": "Savol topilmadi."}
                else:
                    dup = find_duplicate(db, payload.get("savol_lotin", ""), exclude_id=qid)
                    if dup:
                        status, resp = 409, {"error": "Bu matnli savol bazada allaqachon mavjud.", "duplicate": dup}
                    else:
                        old = db["savollar"][idx]
                        old_images = question_image_names(old)
                        q, err = build_question(payload, qid=qid, created=old.get("createdAt"))
                        if err:
                            status, resp = 400, {"error": err}
                        else:
                            db["savollar"][idx] = q
                            save_db(db)
                            delete_images(old_images - question_image_names(q), db)
                            status, resp = 200, {"ok": True, "question": q}
            self.send_json(resp, status)
        except (json.JSONDecodeError, ValueError):
            self.send_json({"error": "So'rov ma'lumoti noto'g'ri."}, 400)
        except Exception as e:  # noqa: BLE001
            self.send_json({"error": f"Server xatosi: {e}"}, 500)

    # ---- DELETE ----
    def do_DELETE(self):
        path = urlparse(self.path).path
        m = re.match(r"^/api/questions/([\w\-]+)$", path)
        if m:
            qid = m.group(1)
            with _DB_LOCK:
                db = load_db()
                idx = next((i for i, q in enumerate(db["savollar"]) if q["id"] == qid), None)
                if idx is None:
                    status, resp = 404, {"error": "Savol topilmadi."}
                else:
                    removed = db["savollar"].pop(idx)
                    save_db(db)
                    delete_images(question_image_names(removed), db)
                    status, resp = 200, {"ok": True}
            self.send_json(resp, status)
            return
        m = re.match(r"^/api/images/([\w.\-]+)$", path)
        if m:
            db = load_db()
            delete_images({m.group(1)}, db)
            self.send_json({"ok": True})
            return
        self.send_json({"error": "Topilmadi."}, 404)


# ============================================================================
#  Ishga tushirish
# ============================================================================

def make_server():
    last_err = None
    for port in range(8000, 8021):
        try:
            return ThreadingHTTPServer(("127.0.0.1", port), Handler), port
        except OSError as e:
            last_err = e
    raise last_err


def main():
    os.makedirs(IMAGES_DIR, exist_ok=True)
    if not os.path.exists(DB_PATH):
        save_db(_empty_db())
    else:
        # Bazani startda xotiraga yuklaymiz (OneDrive faylni shu yerda tayyorlaydi);
        # keyin barcha so'rovlar keshdan ishlaydi — diskka qayta murojaat qilinmaydi.
        try:
            load_db()
            print(f"  Baza yuklandi: {_DB_CACHE['jami_savollar']} ta savol")
        except Exception as e:  # noqa: BLE001
            print(f"  OGOHLANTIRISH: bazani hozircha o'qib bo'lmadi ({e}).")
            print("  OneDrive faylni yuklayotgan bo'lishi mumkin — brauzerni biroz kutib yangilang.")

    # Buyruq qatorida port berilsa (online.bat 8000 beradi) — aniq o'shani ishlatamiz
    fixed = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else None
    if fixed:
        try:
            server, port = ThreadingHTTPServer(("127.0.0.1", fixed), Handler), fixed
        except OSError:
            print(f"  XATO: {fixed}-port band. Boshqa server oynalarini yopib, qayta uruning.")
            return
    else:
        server, port = make_server()
    url = f"http://127.0.0.1:{port}/"
    print("=" * 56)
    print("  Test savollari bazasi ishga tushdi")
    print(f"  Brauzerda oching:  {url}")
    print("  To'xtatish uchun:  bu oynada Ctrl+C bosing")
    print("=" * 56)
    try:
        webbrowser.open(url)
    except Exception:  # noqa: BLE001
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer to'xtatildi.")
        server.shutdown()


if __name__ == "__main__":
    main()
