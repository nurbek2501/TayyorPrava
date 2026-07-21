import json, sys, io, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE="http://127.0.0.1:8000/api"
def post(path, body):
    r=urllib.request.Request(BASE+path, data=json.dumps(body).encode(), headers={"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(r))
def get(path, tok):
    r=urllib.request.Request(BASE+path, headers={"Authorization":"Bearer "+tok})
    return json.load(urllib.request.urlopen(r))

tok = post("/auth/login", {"phone":"+99891000000","password":"user123"})["accessToken"]
tickets = get("/tickets", tok)
print("Biletlar soni      :", len(tickets))
print("20 talik biletlar  :", sum(1 for t in tickets if t["count"]==20))
print("Boshqa hajmdagilar :", [(t["number"],t["count"]) for t in tickets if t["count"]!=20])
print()
# 5-biletga 3 marta kirish
seqs=[]
for i in range(3):
    qs=get("/tickets/5/questions", tok)
    seqs.append([q["id"] for q in qs])
print("5-BILET — 3 marta kirish:")
for i,s in enumerate(seqs,1):
    print(f"  {i}-kirish (1-5 savol id): {[x[:4] for x in s[:5]]}")
print()
print("Har kirishda savol soni :", [len(s) for s in seqs])
print("A'zolik bir xil (set)   :", set(seqs[0])==set(seqs[1])==set(seqs[2]))
print("Tartib har xil          :", seqs[0]!=seqs[1] and seqs[1]!=seqs[2] and seqs[0]!=seqs[2])
