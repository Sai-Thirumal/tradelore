"""
TradeLore API — FastAPI backend.

Run from the project root:
    uvicorn api.main:app --reload

Or from inside the api/ directory:
    uvicorn main:app --reload --app-dir ..
"""

import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from csv_parser import parse_csv
from supabase_client import (
    fetch_all_orders,
    fetch_all_trades,
    replace_trades,
    store_orders,
)
from trade_matcher import match_trades

app = FastAPI(title="TradeLore API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API routes (must be declared before the static file mount) ────────────────

@app.post("/api/import")
async def import_csv(file: UploadFile = File(...)):
    """
    Accept a broker CSV upload.
    1. Parse with pandas
    2. Upsert raw orders into Supabase (deduped by uid)
    3. Re-match ALL stored orders → fresh set of trades
    4. Replace trades table
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    content = await file.read()

    try:
        new_orders = parse_csv(content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not new_orders:
        raise HTTPException(status_code=422, detail="No valid orders found in CSV — check column headers")

    # Persist new orders
    store_orders(new_orders)

    # Re-match from the full order history so multi-file imports stay consistent
    all_orders = fetch_all_orders()
    all_trades = match_trades(all_orders)

    replace_trades(all_trades)

    return {
        "imported_orders": len(new_orders),
        "total_orders":    len(all_orders),
        "total_trades":    len(all_trades),
    }


@app.get("/api/trades")
async def get_trades():
    """Return all pre-computed trades. The browser renders these directly."""
    trades = fetch_all_trades()
    return JSONResponse(content=trades)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Static file serving (index.html, css/, js/) ───────────────────────────────
# Must be mounted AFTER all API routes.
BASE_DIR = Path(__file__).parent.parent          # project root (tradelore/)
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")
