import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = sqlite3.connect("app.db.3lang-test")
qid = c.execute("select id,image_url,topic_id from questions where image_url='/static/images/question_1.webp' limit 1").fetchone()
print("QUESTION:", qid[0][:8], "| topic:", qid[2], "| image:", qid[1])
print("\n-- Savol matni (3 til) --")
for lang,txt in c.execute("select lang,text from question_translations where question_id=? order by lang",(qid[0],)):
    print(f"  [{lang:3}] {txt}")
print("\n-- Izoh (3 til) --")
for lang,expl in c.execute("select lang,explanation from question_translations where question_id=? order by lang",(qid[0],)):
    print(f"  [{lang:3}] {expl}")
print("\n-- Variantlar --")
for oid,corr in c.execute("select id,is_correct from options where question_id=? order by order_index",(qid[0],)):
    tr={l:t for l,t in c.execute("select lang,text from option_translations where option_id=?",(oid,))}
    print(f"  [{'✓' if corr else ' '}] uz={tr.get('uz')} | kaa={tr.get('kaa')} | ru={tr.get('ru')}")
print("\n-- Til bo'yicha to'ldirilganlik (jami) --")
for lang in ('uz','kaa','ru'):
    n=c.execute("select count(*) from question_translations where lang=? and trim(text)<>''",(lang,)).fetchone()[0]
    print(f"  {lang}: {n} savol matni")
c.close()
