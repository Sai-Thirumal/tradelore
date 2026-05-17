import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None

def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
        _client = create_client(url, key)
    return _client


def store_orders(orders: list[dict]) -> None:
    """Upsert raw orders — duplicate UIDs are silently ignored."""
    if not orders:
        return
    get_client().table("trade_orders").upsert(orders, on_conflict="uid").execute()


def fetch_all_orders() -> list[dict]:
    response = (
        get_client()
        .table("trade_orders")
        .select("*")
        .order("trade_time", desc=False)
        .execute()
    )
    return response.data or []


def replace_trades(trades: list[dict]) -> None:
    """Delete all existing trades and insert freshly computed ones.
    Called after every import to keep trades consistent with all stored orders."""
    sb = get_client()
    sb.table("trades").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    if trades:
        sb.table("trades").insert(trades).execute()


def fetch_all_trades() -> list[dict]:
    response = get_client().table("trades").select("*").order("exit_time").execute()
    return response.data or []
