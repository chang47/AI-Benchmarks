# Pip's Outdoor Gear — Q3 inventory and profit report (a live spreadsheet)

Pip runs a small outdoor-gear shop. Their bookkeeper left, and all you have is last quarter's export: `inputs/pips-q3.xlsx`.
It has two sheets:
- **Opening:** the 12 products on hand at 1 July 2025, with quantity, unit cost, list price, reorder point and reorder quantity.
- **Transactions:** every event of July–September 2025, in date order. Columns: `TxnID, Date, Type, SKU, Qty, UnitCost, UnitPrice, Condition, Category, Amount, Note`.

Build Pip a **working spreadsheet** that turns this log into an inventory report and a monthly profit and loss (P&L).

## Deliverable

Save one workbook: **`src/pips-q3-report.xlsx`**.
- Keep the `Opening` and `Transactions` sheets with **exactly the same columns**.
- Add the report sheets described below. Helper sheets and columns are fine.

**It must stay live.**
- Every report number must be a formula that reads the `Transactions` and `Opening` sheets.
- Pip will paste next quarter's log into `Transactions` (same columns, up to **1,000 rows**, same three months, same products). The report must then be correct with no other edits.
- Hard-coded results score only on this quarter's data.
- The file is checked by opening it in LibreOffice Calc and recalculating. Use functions LibreOffice supports: SUMIFS, SUMPRODUCT, INDEX/MATCH, MAXIFS and so on. No macros, no external links, no Python inside the workbook.

## Rules

1. **Product codes.** Match SKUs case-insensitively and ignore surrounding spaces (`tent-2p ` is `TENT-2P`).
2. **Duplicates.** A row whose `TxnID` already appeared earlier in the log is a duplicate export. Ignore it.
3. **Types:**
   - `RECEIPT`: a supplier delivery. It adds `Qty` units at `UnitCost` each.
   - `SALE`: a customer order for `Qty` units at `UnitPrice` each.
   - `WRITEOFF`: `Qty` units lost (breakage, theft). It consumes stock like a sale, but with no revenue.
   - `RETURN`: a customer returns `Qty` units. They are refunded `Qty × UnitPrice` in the month of the return.
     - If `Condition` is `resellable`, the units go back into stock at the unit cost of the **most recent RECEIPT of that SKU on or before the return date**, or the opening unit cost if there is none.
     - If it is `damaged`, nothing goes back into stock.
     - A return of a SKU with **no SALE in an earlier row** of the log is invalid. Ignore it.
   - `EXPENSE`: an operating expense of `Amount` (rent, wages, shipping) in its month.
4. **FIFO.** Stock is used oldest first. The opening stock is the oldest layer, then each receipt or resellable return in the order it happened.
5. **Backorders.**
   - Sales and write-offs are served in log order from stock on hand.
   - Anything that can't be served waits in one queue per SKU (sales and write-offs together).
   - It is served, in order, as soon as stock arrives: a receipt or a resellable return.
   - A sale's revenue and its cost of goods sold (COGS) count **when its units ship**, in the month they ship. That can be later than the sale, and a sale may ship in parts.
   - A write-off's stock cost is a "write-off" in the month it is served.
6. **The monthly P&L:**
   - Revenue: units shipped × their sale's `UnitPrice`.
   - Refunds.
   - COGS: the FIFO cost of the sold units shipped.
   - Write-offs: the FIFO cost of the written-off units.
   - Gross profit = Revenue − Refunds − COGS − Write-offs.
   - Operating expenses.
   - Net profit = Gross profit − Operating expenses.

### A worked example (one product, opening stock 2 @ $10)

| # | Row | What happens |
|---|---|---|
| 1 | Jul 3 SALE 3 @ $30 | 2 ship (cost 2×$10); 1 waits. Jul revenue $60, COGS $20 |
| 2 | Jul 20 RECEIPT 5 @ $12 | the waiting unit ships from it: Jul revenue +$30, COGS +$12. 4 left @ $12 |
| 3 | Aug 2 SALE 2 @ $30 | ships: Aug revenue $60, COGS $24. 2 left @ $12 |
| 4 | Aug 9 RETURN 1 @ $30, resellable | Aug refund $30; 1 unit back into stock @ $12 (latest receipt cost). 3 on hand |
| 5 | Aug 9 (same TxnID as row 4) | duplicate: ignored |
| 6 | Sep 1 WRITEOFF 1 | Sep write-off $12. 2 on hand, stock value $24 |

Totals: Jul revenue $90, COGS $32. Aug revenue $60, refunds $30, COGS $24. Sep write-offs $12.

## Report layout (the checks read these exact cells)

**Sheet `Summary`:**
- Row 2 headers: `Metric`, `2025-07`, `2025-08`, `2025-09`, `Q3 total`.
- Rows 3–9, column A: `Revenue`, `Refunds`, `COGS`, `Write-offs`, `Gross profit`, `Operating expenses`, `Net profit`.
- Columns B–D: the monthly values. Column E: the quarter total.

**Sheet `Stock`:**
- Row 1 headers.
- Rows 2–13, one per product in the same order as `Opening`. Columns:
  - A: SKU
  - B: units on hand at 30 Sep
  - C: units still backordered (unfilled sale units)
  - D: FIFO value of the stock on hand
  - E: `YES` if on hand is below the reorder point, else `NO`
  - F: the reorder quantity if YES, else 0

**Sheet `Exceptions`:**
- Row 1 headers.
- From row 2 down, column A lists the `TxnID` of every row you ignored; column B says why.

Round money to the cent in your head, not in the cells: the checks allow ±$0.01.
