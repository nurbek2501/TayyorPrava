import json, sys, io, urllib.request, urllib.parse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE="http://127.0.0.1:8000/api"
def call(method, path, body=None, tok=None):
    h={"Content-Type":"application/json"}
    if tok: h["Authorization"]="Bearer "+tok
    data=json.dumps(body).encode() if body is not None else None
    r=urllib.request.Request(BASE+path, data=data, headers=h, method=method)
    with urllib.request.urlopen(r) as resp:
        return resp.status, (json.load(resp) if resp.status not in (204,) else None)
tok=call("POST","/admin/auth/login",{"login":"admin","password":"admin"})[1]["accessToken"]
# sinov savolini topib o'chirish
q=urllib.parse.quote("yangi savol qoshish testi")
items=call("GET","/admin/questions?search="+q+"&page=1",tok=tok)[1]["items"]
print("Topilgan sinov savollari:", len(items))
for it in items:
    if "2026" in it["text"]["uz"]:
        # 3 til saqlanganini ko'rsatamiz, keyin o'chiramiz
        print("  uz/kaa/ru:", bool(it["text"]["uz"]), bool(it["text"]["kaa"]), bool(it["text"]["ru"]), "->", it["text"]["uz"][:40])
        st,_=call("DELETE","/admin/questions/"+it["id"],tok=tok)
        print("  o'chirildi, status:", st)
total=call("GET","/admin/questions?page=1",tok=tok)[1]["total"]
print("Jami savol (qaytdi):", total)
