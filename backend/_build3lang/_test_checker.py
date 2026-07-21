import json, sys, io, time, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE="http://127.0.0.1:8000/api"
def call(method, path, body=None, tok=None):
    h={"Content-Type":"application/json"}
    if tok: h["Authorization"]="Bearer "+tok
    data=json.dumps(body).encode() if body is not None else None
    r=urllib.request.Request(BASE+path, data=data, headers=h, method=method)
    return json.load(urllib.request.urlopen(r))
# backend tayyor bo'lguncha
for _ in range(20):
    try: urllib.request.urlopen(BASE+"/topics"); break
    except Exception: time.sleep(1)
tok=call("POST","/admin/auth/login",{"login":"admin","password":"admin"})["accessToken"]
print("Admin token OK")
# mavjud bir savolning lotin matni
q=call("GET","/admin/questions?page=1",tok=tok)["items"][0]
lat=q["text"]["uz"]; cyr=q["text"]["kaa"]
print("\nMavjud savol (lotin):", lat[:60])
print("Uning kirili      :", cyr[:60])
print("\n--- TEKSHIRUV (lotin/kirill farqsiz) ---")
r1=call("POST","/admin/questions/check",{"text":cyr},tok)   # kirillda yozilgan
print("Kirillda tekshir  -> exists:", r1["exists"], "| dup:", (r1.get("duplicateText") or '')[:45])
r2=call("POST","/admin/questions/check",{"text":"Butunlay yangi savol qwerty 99887766"},tok)
print("Yangi matn tekshir-> exists:", r2["exists"])
print("\n--- RUS TARJIMA ---")
r3=call("POST","/admin/questions/translate",{"texts":["Svetoforning qizil chirog'i nimani bildiradi?","Ha","Yo'q"]},tok)
print("ok:", r3["ok"])
for t in r3["translations"]: print("   ->", t)
