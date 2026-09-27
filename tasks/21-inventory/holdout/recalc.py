"""Recalculate a workbook headlessly with LibreOffice and return the path of a copy with fresh cached values.
LibreOffice does NOT recalculate .xlsx formulas on load by default (it trusts Excel's cached values), so we run it with a
private profile whose OOXMLRecalcMode = 0 ("always recalculate"). A workbook written by openpyxl has no cached values at
all, so without this every formula would read as empty."""
import os, shutil, subprocess, tempfile, time
from pathlib import Path

SOFFICE = os.environ.get("SOFFICE") or next((p for p in [r"C:\Program Files\LibreOffice\program\soffice.com",
    r"C:\Program Files\LibreOffice\program\soffice.exe", "/usr/bin/soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"] if Path(p).exists()), "soffice")

XCU = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>"""


def recalc(src: str | Path, timeout: int = 300) -> Path:
    src = Path(src).resolve()
    work = Path(tempfile.mkdtemp(prefix="vb-recalc-"))
    prof = work / "profile" / "user"
    prof.mkdir(parents=True)
    (prof / "registrymodifications.xcu").write_text(XCU, encoding="utf-8")
    inp = work / "in" / src.name
    inp.parent.mkdir(); shutil.copy(src, inp)
    out = work / "out"; out.mkdir()
    cmd = [SOFFICE, f"-env:UserInstallation={(work / 'profile').as_uri()}", "--headless", "--norestore", "--nolockcheck",
           "--calc", "--convert-to", "xlsx:Calc MS Excel 2007 XML", "--outdir", str(out), str(inp)]
    t0 = time.time()
    subprocess.run(cmd, capture_output=True, timeout=timeout)
    res = out / src.name
    if not res.exists():
        raise RuntimeError(f"LibreOffice produced no output for {src.name} ({time.time() - t0:.0f}s)")
    return res
