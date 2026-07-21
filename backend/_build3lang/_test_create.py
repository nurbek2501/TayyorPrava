import json, sys, io, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE="http://127.0.0.1:8000/api"
def call(method, path, body=None, tok=None):
    h={"Content-Type":"application/json"}
    if tok: h["Authorization"]="Bearer "+tok
    data=json.dumps(body).encode() if body is not None else None
    r=urllib.request.Request(BASE+path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, (json.load(resp) if resp.status!=204 else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())
tok=call("POST","/admin/auth/login",{"login":"admin","password":"admin"})[1]["accessToken"]
before=call("GET","/admin/questions?page=1",tok=tok)[1]["total"]
print("Oldin jami savol:", before)
# Sahifa yuboradigan payload (text{uz,kaa,ru} + options)
payload={"topicId":1,
  "text":{"uz":"Sinov: yangi savol qoshish testi 2026","kaa":"Синов: янги савол қошиш тести 2026","ru":"Тест: добавление нового вопроса 2026"},
  "options":[
    {"text":{"uz":"To'g'ri javob","kaa":"Тўғри жавоб","ru":"Правильный ответ"},"isCorrect":True},
    {"text":{"uz":"Noto'g'ri","kaa":"Нотўғри","ru":"Неверно"},"isCorrect":False}]}
st,created=call("POST","/admin/questions",payload,tok)
print("Create status:", st, "| id:", (created or {}).get("id","")[:8])
after=call("GET","/admin/questions?page=1",tok=tok)[1]["total"]
print("Keyin jami savol:", after, "(+%d)"%(after-before))
# 3 til saqlanganini tekshir
qid=created["id"]
q=call("GET","/admin/questions?search=qoshish testi 2026",tok=tok)[1]["items"][0]
print("Saqlangan 3 til -> uz:", bool(q["text"]["uz"]), "| kaa:", bool(q["text"]["kaa"]), "| ru:", bool(q["text"]["ru"]))
# tozalash
dst=call("DELETE","/admin/questions/"+qid,tok=tok)[0]
final=call("GET","/admin/questions?page=1",tok=tok)[1]["total"]
print("O'chirildi (status %d), jami qaytdi:"%dst, final)
