import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = sqlite3.connect("app.db.3lang-test")
def one(q,*a): return c.execute(q,a).fetchone()[0]

print("=== TO'LDIRILGANLIK (bo'sh bo'lmagan matn) ===")
print("Savollar jami            :", one("select count(*) from questions"))
for l in ('uz','kaa','ru'):
    print(f"  savol matni [{l}]      :", one("select count(*) from question_translations where lang=? and trim(text)<>''", l))
print("Variantlar jami          :", one("select count(*) from options"))
for l in ('uz','kaa','ru'):
    print(f"  variant matni [{l}]    :", one("select count(*) from option_translations where lang=? and trim(text)<>''", l))
print("Izohli savollar (uz)     :", one("select count(*) from question_translations where lang='uz' and explanation is not null and trim(explanation)<>''"))
for l in ('kaa','ru'):
    print(f"  izoh [{l}]             :", one("select count(*) from question_translations where lang=? and explanation is not null and trim(explanation)<>''", l))
print("Rasmli savollar          :", one("select count(*) from questions where image_url is not null and image_url<>''"))

print("\n=== BO'SH RUS MATNI QOLDIMI? ===")
print("Bo'sh ru savol matni     :", one("select count(*) from question_translations where lang='ru' and trim(text)=''"))
print("Bo'sh ru variant matni   :", one("select count(*) from option_translations where lang='ru' and trim(text)=''"))

# 3 namuna savol (izohli, rasmli)
print("\n=== NAMUNA SAVOLLAR (3 tilda) ===")
qids = [r[0] for r in c.execute("select question_id from question_translations where lang='ru' and text like '%перекрёст%' limit 1").fetchall()]
qids += [r[0] for r in c.execute("select id from questions where image_url like '%question_1224%' limit 1").fetchall()]
for qid in qids[:2]:
    img = one("select image_url from questions where id=?", qid)
    print("-"*60)
    print("rasm:", img)
    for l in ('uz','kaa','ru'):
        t,e = c.execute("select text,explanation from question_translations where question_id=? and lang=?",(qid,l)).fetchone()
        print(f"  [{l}] {t}")
    print("  izoh:")
    for l in ('uz','kaa','ru'):
        e = c.execute("select explanation from question_translations where question_id=? and lang=?",(qid,l)).fetchone()[0]
        print(f"     [{l}] {e}")
    print("  variantlar:")
    for oid,corr in c.execute("select id,is_correct from options where question_id=? order by order_index",(qid,)):
        tr={ll:tt for ll,tt in c.execute("select lang,text from option_translations where option_id=?",(oid,))}
        print(f"     [{'✓' if corr else ' '}] uz={tr['uz']} | kaa={tr['kaa']} | ru={tr['ru']}")
c.close()
