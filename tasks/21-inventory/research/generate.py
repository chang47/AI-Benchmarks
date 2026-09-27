"""Generate task 21's data deterministically: the Q3 input workbook the models get (inputs/pips-q3.xlsx) and a hidden
alternate Q3 transaction log (holdout/hidden-transactions.json) for the live-formula test. Same opening stock and
months; different transactions, including their own planted quirks.
    python tasks/21-inventory/research/generate.py
"""
import datetime as dt, json, random, sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "holdout"))
from engine import run  # noqa: E402

OPENING = [  # sku, name, qty, unit_cost, list_price, reorder_point, reorder_qty, weekly demand
    ("TENT-2P", "Two-person tent", 40, 88.00, 189.00, 15, 40, 9),
    ("TENT-4P", "Four-person tent", 18, 142.50, 299.00, 8, 20, 4),
    ("BAG-SUM", "Summer sleeping bag", 60, 31.25, 69.00, 20, 60, 12),
    ("BAG-WIN", "Winter sleeping bag", 25, 74.00, 159.00, 10, 30, 3),
    ("PAD-FOAM", "Foam sleeping pad", 80, 9.40, 24.00, 30, 80, 15),
    ("STOVE-GAS", "Gas camp stove", 35, 27.80, 59.00, 12, 36, 6),
    ("LAMP-LED", "LED lantern", 90, 11.60, 29.00, 30, 100, 16),
    ("PACK-35", "35 L daypack", 45, 36.00, 79.00, 15, 40, 7),
    ("PACK-65", "65 L trekking pack", 20, 97.00, 219.00, 8, 20, 3),
    ("BOTTLE-1L", "1 L steel bottle", 150, 6.10, 18.00, 50, 150, 30),
    ("CHAIR-FLD", "Folding camp chair", 30, 22.40, 49.00, 12, 30, 6),
    ("FILTER-H2O", "Water filter", 28, 41.00, 89.00, 10, 24, 5),
]
MONTHS = ["2025-07", "2025-08", "2025-09"]
START, END = dt.date(2025, 7, 1), dt.date(2025, 9, 30)


def make_log(seed: int, n_target: int = 420):
    rnd = random.Random(seed)
    rows, nid = [], [1000]

    def tid():
        nid[0] += rnd.choice([1, 1, 1, 2]); return f"T{nid[0]}"

    def sku_variant(s):  # planted quirk: inconsistent SKU spelling (matched case-insensitively, spaces ignored)
        r = rnd.random()
        return s.lower() if r < 0.03 else (s + " " if r < 0.05 else (" " + s.title() if r < 0.06 else s))

    cost = {o[0]: o[3] for o in OPENING}
    day = START
    while day <= END:
        # sales: weekly demand spread over days, surges in July (peak season)
        for sku, _, _, _, price, _, _, wk in OPENING:
            lam = wk / 7 * (1.8 if day.month == 7 else 1.3 if day.month == 8 else 0.9)
            q = sum(1 for _ in range(4) if rnd.random() < lam / 4)
            if q and rnd.random() < 0.55:
                disc = rnd.choice([1.0, 1.0, 1.0, 0.9, 0.85])
                rows.append(dict(id=tid(), date=day, type="SALE", sku=sku_variant(sku), qty=q * rnd.choice([1, 1, 2]), unit_price=round(price * disc, 2)))
        # receipts: roughly fortnightly per SKU, some suppliers raise prices mid-quarter
        for sku, *_ in OPENING:
            if rnd.random() < 0.05:
                if day > dt.date(2025, 8, 10) and rnd.random() < 0.5: cost[sku] = round(cost[sku] * rnd.choice([1.04, 1.06, 1.08]), 2)
                q = [o for o in OPENING if o[0] == sku][0][6]
                rows.append(dict(id=tid(), date=day, type="RECEIPT", sku=sku_variant(sku), qty=int(q * rnd.choice([0.5, 0.75, 1.0])), unit_cost=cost[sku]))
        if rnd.random() < 0.09:
            sku = rnd.choice(OPENING)
            rows.append(dict(id=tid(), date=day, type="RETURN", sku=sku_variant(sku[0]), qty=1, unit_price=sku[4], condition=rnd.choice(["resellable", "resellable", "damaged"])))
        if rnd.random() < 0.05:
            sku = rnd.choice(OPENING)
            rows.append(dict(id=tid(), date=day, type="WRITEOFF", sku=sku_variant(sku[0]), qty=rnd.choice([1, 1, 2, 3]), note=rnd.choice(["breakage", "water damage", "missing in count"])))
        if day.day == 1: rows.append(dict(id=tid(), date=day, type="EXPENSE", category="Rent", amount=3200.00))
        if day.day in (15, 28): rows.append(dict(id=tid(), date=day, type="EXPENSE", category="Wages", amount=round(rnd.uniform(3900, 4400), 2)))
        if day.weekday() == 4: rows.append(dict(id=tid(), date=day, type="EXPENSE", category="Shipping", amount=round(rnd.uniform(180, 420), 2)))
        day += dt.timedelta(days=1)
    # planted quirks: two exact duplicate rows (same TxnID re-exported), and a return of a product that was never sold
    for _ in range(2):
        k = rnd.randrange(len(rows) // 4, 3 * len(rows) // 4); dup = dict(rows[k]); rows.insert(k + 1, dup)
    never = "FILTER-H2O"
    first_sale = min((i for i, r in enumerate(rows) if r["type"] == "SALE" and r["sku"].strip().upper() == never), default=len(rows))
    rows.insert(max(1, first_sale // 2), dict(id="T0999", date=rows[max(1, first_sale // 2)]["date"], type="RETURN", sku=never, qty=1, unit_price=89.0, condition="resellable"))
    rows.sort(key=lambda r: r["date"])  # the log is in date order (stable: same-day rows keep their order)
    return rows


def write_input(path: Path, rows):
    wb = Workbook(); ws = wb.active; ws.title = "Opening"
    ws.append(["SKU", "Product", "Qty", "UnitCost", "ListPrice", "ReorderPoint", "ReorderQty"])
    for sku, name, q, c, p, rp, rq, _ in OPENING: ws.append([sku, name, q, c, p, rp, rq])
    tx = wb.create_sheet("Transactions")
    tx.append(["TxnID", "Date", "Type", "SKU", "Qty", "UnitCost", "UnitPrice", "Condition", "Category", "Amount", "Note"])
    for r in rows:
        tx.append([r["id"], r["date"], r["type"], r.get("sku"), r.get("qty"), r.get("unit_cost"), r.get("unit_price"), r.get("condition"), r.get("category"), r.get("amount"), r.get("note")])
    for c in tx["B"][1:]: c.number_format = "yyyy-mm-dd"
    for w in (ws, tx):
        for c in w[1]: c.font = Font(bold=True)
    wb.save(path)


def opening_dicts():
    return [dict(sku=o[0], qty=o[2], unit_cost=o[3], reorder_point=o[5], reorder_qty=o[6]) for o in OPENING]


if __name__ == "__main__":
    given, hidden = make_log(20250723), make_log(20250788)
    write_input(ROOT / "inputs" / "pips-q3.xlsx", given)
    ser = lambda rows: [{**r, "date": r["date"].isoformat()} for r in rows]
    (ROOT / "holdout" / "hidden-transactions.json").write_text(json.dumps(ser(hidden), indent=0))
    for name, rows in [("given", given), ("hidden", hidden)]:
        key = run(opening_dicts(), rows, MONTHS)
        (ROOT / "holdout" / f"answer-{name}.json").write_text(json.dumps(key, indent=1))
        inv = key["inventory"]
        print(f"{name}: {len(rows)} rows · revenue {key['totals']['revenue']:,.2f} · net {key['totals']['net_profit']:,.2f} · "
              f"backordered SKUs {sum(1 for v in inv.values() if v['backordered'])} · exceptions {len(key['exceptions'])} · reorder {sum(v['reorder'] for v in inv.values())}")
