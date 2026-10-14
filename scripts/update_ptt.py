"""Fetch official PTT SOAP data and publish validated static JSON for GitHub Pages."""
import datetime as dt
import html
import json
import pathlib
import urllib.request
import xml.etree.ElementTree as ET

URL = "https://orapiweb.pttor.com/oilservice/OilPrice.asmx"
SOAP = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
<soap:Body><CurrentOilPrice xmlns="http://www.pttor.com"><Language>TH</Language></CurrentOilPrice></soap:Body>
</soap:Envelope>"""
request = urllib.request.Request(URL, data=SOAP.encode("utf-8"), headers={
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": "https://orapiweb.pttor.com/CurrentOilPrice",
    "User-Agent": "UyenM-Market/1.0",
})
with urllib.request.urlopen(request, timeout=25) as response:
    raw = response.read(1_000_000)
root = ET.fromstring(raw)
result = next((e.text for e in root.iter() if e.tag.split("}")[-1] == "CurrentOilPriceResult"), None)
if not result:
    raise ValueError("PTT SOAP response missing CurrentOilPriceResult")
result = html.unescape(result).strip()
data_root = ET.fromstring(result)
prices = []
for item in data_root.iter():
    children = {e.tag.split("}")[-1].lower(): (e.text or "").strip() for e in item}
    product = next((children[k] for k in ("product", "productname", "product_name", "oilname") if children.get(k)), None)
    amount = next((children[k] for k in ("price", "retailprice", "oilprice") if children.get(k)), None)
    if not product or not amount:
        continue
    try:
        price = float(amount.replace(",", ""))
    except ValueError:
        continue
    if 1 <= price <= 200 and not any(p["name"] == product for p in prices):
        prices.append({"name": product, "price": price})
if not prices:
    raise ValueError("PTT response had no validated prices; leaving previous data intact")
out = {"source": URL, "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "prices": prices}
path = pathlib.Path("data/ptt-prices.json")
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Saved {len(prices)} official PTT fuel prices")
