import sqlite3, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = sqlite3.connect("app.db")
def one(q,*a): return c.execute(q,a).fetchone()[0]
print("=== ISHLAB CHIQARISH app.db ===")
print("Savollar jami       :", one("select count(*) from questions"))
for l in ('uz','kaa','ru'):
    print(f"  savol matni [{l}] :", one("select count(*) from question_translations where lang=? and trim(text)<>''", l))
print("Variant jami        :", one("select count(*) from options"))
print("  ru variant to'la  :", one("select count(*) from option_translations where lang='ru' and trim(text)<>''"))
print("Topiclar (mavzu)    :", one("select count(*) from topics"))
print()
print("=== RASM ===")
print("Asl rasmli savol    :", one("select count(*) from questions where image_url not like '%no-image%' and image_url is not null"))
print("Placeholder (no-image):", one("select count(*) from questions where image_url like '%no-image%'"))
print("Rasmsiz (image yo'q):", one("select count(*) from questions where image_url is null or image_url=''"))
ph = os.path.join("uploads","images","no-image.png")
print("no-image.png fayli  :", "BOR ✓" if os.path.exists(ph) else "YO'Q ✗", f"({round(os.path.getsize(ph)/1024)} KB)" if os.path.exists(ph) else "")
print()
print("=== Namuna: rasmsiz bo'lgan savol endi placeholder bilan ===")
qid,img = c.execute("select id,image_url from questions where image_url like '%no-image%' limit 1").fetchone()
print("image_url:", img)
for l in ('uz','kaa','ru'):
    t = c.execute("select text from question_translations where question_id=? and lang=?",(qid,l)).fetchone()[0]
    print(f"  [{l}] {t}")
c.close()
