"""Answer-key engine for task 21 (Pip's Outdoor Gear): an event-by-event warehouse simulation with a literal FIFO
queue of cost layers and a FIFO queue of unfilled demand. It follows the brief's rules exactly; every number in the
answer key comes from here and is cross-checked against an independent formula workbook and a blind re-implementation.

Rules (mirrors the brief):
- SKUs are matched case-insensitively with surrounding spaces ignored.
- A row whose TxnID already appeared earlier is a duplicate: ignore it (and list it as an exception).
- RECEIPT adds a cost layer (qty @ unit cost). A RETURN(resellable) adds a layer at the unit cost of the most recent
  RECEIPT of that SKU on or before the return date (the opening cost if none). A RETURN of a SKU with no earlier
  SALE is invalid: ignore it (exception). RETURN(damaged) adds no stock.
- SALE and WRITEOFF are demand, served in date order (then row order) from stock, oldest layer first (FIFO). Demand that
  cannot be met waits (backorder) and is served, in order, as soon as stock arrives. Revenue and COGS of a sale are
  recognised when its units ship, in the month they ship. A write-off's cost is an expense in the month it is filled.
- A RETURN refunds qty x unit price in the month of the return (both conditions).
- EXPENSE rows are operating expenses in their month.
- Monthly: revenue, refunds, COGS, write-offs (cost), gross profit = revenue - refunds - COGS - write-offs,
  operating expenses, net profit = gross profit - operating expenses.
- End of quarter per SKU: on hand qty, backordered qty (unfilled SALE units only), FIFO stock value.
"""
from __future__ import annotations
from collections import deque
from dataclasses import dataclass, field
import datetime as dt


def norm_sku(s) -> str:
    return str(s or "").strip().upper()


@dataclass
class SkuState:
    layers: deque = field(default_factory=deque)       # [qty, unit_cost] oldest first
    waiting: deque = field(default_factory=deque)      # [qty_left, kind, unit_price, txn_id, month] unfilled demand
    last_receipt_cost: float = 0.0
    sold_any: bool = False


def month_key(d: dt.date) -> str:
    return f"{d.year}-{d.month:02d}"


def run(opening: list[dict], txns: list[dict], months: list[str]) -> dict:
    """opening: [{sku, qty, unit_cost, reorder_point, reorder_qty}]; txns: rows as dicts (see brief)."""
    st: dict[str, SkuState] = {}
    for o in opening:
        s = SkuState(); s.layers.append([int(o["qty"]), float(o["unit_cost"])]); s.last_receipt_cost = float(o["unit_cost"])
        st[norm_sku(o["sku"])] = s
    P = {m: dict(revenue=0.0, refunds=0.0, cogs=0.0, writeoffs=0.0, opex=0.0) for m in months}
    exceptions: list[tuple[str, str]] = []
    late = [0]  # sale units shipped in a later month than sold (backorders crossing a month end)
    seen: set[str] = set()
    rows = sorted(enumerate(txns), key=lambda it: (it[1]["date"], it[0]))  # date order, then row order

    def serve(sku: str, month: str):
        s = st[sku]
        while s.waiting and s.layers:
            need = s.waiting[0]
            lay = s.layers[0]
            q = min(need[0], lay[0])
            cost = q * lay[1]
            if need[1] == "SALE":
                P[month]["revenue"] += q * need[2]; P[month]["cogs"] += cost
                if need[4] != month: late[0] += q
            else:
                P[month]["writeoffs"] += cost
            need[0] -= q; lay[0] -= q
            if lay[0] == 0: s.layers.popleft()
            if need[0] == 0: s.waiting.popleft()

    for _, t in rows:
        tid = str(t["id"]).strip()
        if tid in seen:
            exceptions.append((tid, "duplicate transaction id — ignored")); continue
        seen.add(tid)
        m = month_key(t["date"]); typ = t["type"]
        if typ == "EXPENSE":
            P[m]["opex"] += float(t["amount"]); continue
        sku = norm_sku(t["sku"]); s = st[sku]; qty = int(t["qty"])
        if typ == "RECEIPT":
            s.layers.append([qty, float(t["unit_cost"])]); s.last_receipt_cost = float(t["unit_cost"])
        elif typ == "SALE":
            s.waiting.append([qty, "SALE", float(t["unit_price"]), tid, m]); s.sold_any = True
        elif typ == "WRITEOFF":
            s.waiting.append([qty, "WRITEOFF", 0.0, tid, m])
        elif typ == "RETURN":
            if not s.sold_any:
                exceptions.append((tid, "return of a product never sold — ignored")); continue
            P[m]["refunds"] += qty * float(t["unit_price"])
            if str(t.get("condition", "")).strip().lower() == "resellable":
                s.layers.append([qty, s.last_receipt_cost])
        else:
            raise ValueError(f"unknown type {typ}")
        serve(sku, m)

    pl = {}
    for m in months:
        p = P[m]; gross = p["revenue"] - p["refunds"] - p["cogs"] - p["writeoffs"]
        pl[m] = {**{k: round(v, 2) for k, v in p.items()}, "gross_profit": round(gross, 2), "net_profit": round(gross - p["opex"], 2)}
    inv = {}
    for o in opening:
        k = norm_sku(o["sku"]); s = st[k]
        on_hand = sum(q for q, _ in s.layers)
        inv[k] = {"on_hand": on_hand, "backordered": sum(w[0] for w in s.waiting if w[1] == "SALE"),
                  "stock_value": round(sum(q * c for q, c in s.layers), 2),
                  "reorder": on_hand < int(o["reorder_point"]), "reorder_qty": int(o["reorder_qty"]) if on_hand < int(o["reorder_point"]) else 0}
    return {"pl": pl, "inventory": inv, "exceptions": exceptions, "late_units": late[0],
            "totals": {k: round(sum(pl[m][k] for m in months), 2) for k in ["revenue", "refunds", "cogs", "writeoffs", "gross_profit", "opex", "net_profit"]}}
