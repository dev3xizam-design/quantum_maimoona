# Scrapes the LA Remote Sellers Commission "Remittance Rates" (Sales Tax authority 1000) for one
# filing period, all parishes:  python3 scripts/rates/fetch-la-rsc.py 10-01-2026 > data/rates/raw/LA/rsc-raw-2026-10.json
# (then parse with the snippet in data/rates/sources/LA.md into rsc-rates-YYYY-MM.json)
import re,html,sys,urllib.request,urllib.parse,http.cookiejar,json,time
U='https://remotesellersfiling.louisiana.gov/lookup/lookup.aspx'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)); op.addheaders=[('User-Agent','Mozilla/5.0')]
def hidden(s): return {n:html.unescape(v) for n,v in re.findall(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"',s)}
def post(s,fields,target):
    d=hidden(s); d.update(fields); d['__EVENTTARGET']=target
    return op.open(U,urllib.parse.urlencode(d).encode()).read().decode('utf-8','ignore')
def sel(s,name):
    m=re.search(r'<select name="%s".*?</select>'%re.escape(name),s,re.S); 
    return re.findall(r'<option (selected="selected" )?value="([^"]*)"',m.group(0)) if m else []
s=op.open(U).read().decode('utf-8','ignore')
period=sys.argv[1]; codes=sys.argv[2:] or [v for _,v in sel(s,'ddlJurisdiction')]
base={'ddlStateSelect':'LA','ddlAuthority':'1000','ddlReturn':'1000'}
out={}
for c in codes:
    f=dict(base,ddlJurisdiction=c,ddlFilingPeriod=period)
    s=post(s,f,'ddlJurisdiction'); s=post(s,dict(f),'ddlFilingPeriod')
    tabs=re.findall(r'<table[^>]*id="[^"]*(?:Grid|gv|grid)[^"]*".*?</table>',s,re.S) or re.findall(r'<table.*?</table>',s,re.S)
    rows=[]
    for t in tabs:
        for r in re.findall(r'<tr.*?</tr>',t,re.S):
            cells=[re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',x))).strip() for x in re.findall(r'<t[dh][^>]*>.*?</t[dh]>',r,re.S)]
            if cells and any(cells): rows.append(cells)
    out[c]=rows; print(c,len(rows),file=sys.stderr); time.sleep(0.5)
print(json.dumps(out,indent=0))
