import requests, time, brotli, json

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.nseindia.com/',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
})

def nse_get(url):
    r = session.get(url, timeout=10)
    content = r.content
    # Try brotli decode if needed
    encoding = r.headers.get('Content-Encoding', '')
    if encoding == 'br' or (content and content[0:2] == b'\xf0\xff'):
        try:
            content = brotli.decompress(content)
        except Exception:
            pass
    return json.loads(content)

print("Init session...")
session.get('https://www.nseindia.com/market-data/live-equity-market', timeout=10)
time.sleep(2)

print("Test 1: allIndices")
try:
    data = nse_get('https://www.nseindia.com/api/allIndices')
    indices = data.get('data', [])
    print(f"  Got {len(indices)} indices")
    for idx in indices[:5]:
        print(f"  {idx.get('indexSymbol')}: {idx.get('last')} ({idx.get('percentChange')}%)")
except Exception as e:
    print("  Error:", e)

time.sleep(1)
print("\nTest 2: RELIANCE quote")
try:
    q = nse_get('https://www.nseindia.com/api/quote-equity?symbol=RELIANCE')
    price = q.get('priceInfo', {}).get('lastPrice', 0)
    print(f"  Reliance: Rs.{price}")
except Exception as e:
    print("  Error:", e)

print("\nTest 3: nsepython")
try:
    from nsepython import nse_eq, nifty50_details
    # nifty details
    nifty = nifty50_details()
    print("  nsepython nifty50 keys:", list(nifty.keys())[:5] if nifty else "empty")
except Exception as e:
    print("  nsepython error:", e)
