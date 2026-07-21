#!/usr/bin/env python3
"""Regenere apps/web/lib/supabase/types.ts depuis le schema Supabase en ligne.
Usage : python scripts/gen-types.py   (lit apps/web/.env.local)"""
import json, urllib.request, sys, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env={}
for l in open('apps/web/.env.local',encoding='utf-8'):
    l=l.strip()
    if l and not l.startswith('#') and '=' in l:
        k,v=l.split('=',1); env[k.strip()]=v.strip()
URL=env['NEXT_PUBLIC_SUPABASE_URL']; SVC=env['SUPABASE_SERVICE_ROLE_KEY']
r=urllib.request.Request(f'{URL}/rest/v1/', headers={'apikey':SVC,'Authorization':f'Bearer {SVC}','Accept':'application/openapi+json'})
d=json.load(urllib.request.urlopen(r,timeout=30)); defs=d.get('definitions',{})
def tstype(p):
    t=p.get('type'); fmt=p.get('format','')
    if t in ('integer','number'): return 'number'
    if t=='boolean': return 'boolean'
    if t=='array': return tstype(p.get('items',{}))+'[]'
    if fmt in ('jsonb','json'): return 'Json'
    return 'string'
def emit(name,schema):
    props=schema.get('properties',{}); req=set(schema.get('required',[]))
    rows=[];ins=[];upd=[]
    for col,p in props.items():
        base=tstype(p); nn=col not in req
        rows.append(f"          {col}: {base}{' | null' if nn else ''}")
        ins.append(f"          {col}{'?' if nn else ''}: {base}{' | null' if nn else ''}")
        upd.append(f"          {col}?: {base}{' | null' if nn else ''}")
    return (f"      {name}: {{\n        Row: {{\n"+"\n".join(rows)+"\n        }\n        Insert: {\n"+"\n".join(ins)+"\n        }\n        Update: {\n"+"\n".join(upd)+"\n        }\n        Relationships: []\n      }}")
tables=sorted(k for k in defs if not k.startswith('rpc.'))
print("regenere", len(tables), "tables:", ", ".join(tables))
