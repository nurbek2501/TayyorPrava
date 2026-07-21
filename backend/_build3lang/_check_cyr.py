import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
c = json.load(open('_build3lang/cyr.json', encoding='utf-8'))
u = json.load(open('_build3lang/uniq.json', encoding='utf-8'))
for k in ['q0001','q0002','q0005','o0001','o0005','d0001']:
    print(k)
    print('  UZ :', u[k])
    print('  KAA:', c[k])
