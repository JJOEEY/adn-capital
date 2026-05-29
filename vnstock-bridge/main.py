import importlib.metadata
import os
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query

app = FastAPI(title="ADN Vnstock Bridge", version="1.0.0")

SPONSOR_PACKAGES = ("vnstock_data", "vnstock_news")
_ready = False
_ready_errors: list[str] = []


def now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


def package_version(name: str) -> str | None:
  try:
    return importlib.metadata.version(name.replace("_", "-"))
  except importlib.metadata.PackageNotFoundError:
    return None


def install_sponsor_package(package_name: str, api_key: str) -> None:
  from vnstock_installer.api import VnstockAPIClient

  client = VnstockAPIClient(api_key)
  try:
    client.save_api_key()
    client.register_device()
  except Exception:
    pass
  ok, archive_path = client.download_package(package_name)
  if not ok:
    raise RuntimeError(f"{package_name}: {archive_path}")

  with tempfile.TemporaryDirectory() as tmp:
    tmp_path = Path(tmp)
    with tarfile.open(archive_path, "r:gz") as tar:
      tar.extractall(tmp_path)
    candidates = [p for p in tmp_path.iterdir() if p.is_dir() and p.name.startswith(package_name)]
    if not candidates:
      raise RuntimeError(f"{package_name}: extracted package not found")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--no-deps", str(candidates[0])])


def ensure_packages() -> tuple[bool, list[str]]:
  global _ready, _ready_errors
  if _ready:
    return True, []

  errors: list[str] = []
  missing = [pkg for pkg in SPONSOR_PACKAGES if package_version(pkg) is None]
  api_key = os.getenv("VNSTOCK_API_KEY", "").strip()

  if missing:
    if not api_key:
      _ready_errors = [f"missing packages: {', '.join(missing)}; VNSTOCK_API_KEY is not configured"]
      return False, _ready_errors
    for package_name in missing:
      try:
        install_sponsor_package(package_name, api_key)
      except Exception as exc:
        errors.append(f"{package_name}: {str(exc)[:180]}")

  try:
    import vnstock_data  # noqa: F401
    import vnstock_news  # noqa: F401
  except Exception as exc:
    errors.append(f"import failed: {str(exc)[:180]}")

  _ready = len(errors) == 0
  _ready_errors = errors
  return _ready, errors


def df_to_records(df: Any) -> list[dict[str, Any]]:
  if df is None:
    return []
  if not isinstance(df, pd.DataFrame):
    return []
  if isinstance(df.columns, pd.MultiIndex):
    df = df.copy()
    df.columns = ["_".join([str(part) for part in col if str(part) != ""]).strip("_") for col in df.columns]
  df = df.where(pd.notnull(df), None)
  return df.to_dict("records")


def number_value(value: Any) -> float | None:
  try:
    parsed = float(value)
    if parsed != parsed:
      return None
    return parsed
  except Exception:
    return None


def format_billion(value: float | None) -> str | None:
  if value is None:
    return None
  return f"{abs(value) / 1_000_000_000:.1f} tỷ".replace(".", ",")


def row_symbol(row: dict[str, Any]) -> str | None:
  symbol = row.get("symbol") or row.get("ticker") or row.get("listing_symbol")
  if not isinstance(symbol, str):
    return None
  symbol = symbol.strip().upper()
  if not symbol or not symbol.isalnum() or not (3 <= len(symbol) <= 4):
    return None
  if symbol.startswith("C") and len(symbol) > 3:
    return None
  return symbol


def flow_items(records: list[dict[str, Any]], value_key: str = "value_1d", side: str = "buy", top: int = 10) -> list[str]:
  rows = []
  for row in records:
    symbol = row_symbol(row)
    value = number_value(row.get(value_key))
    if not symbol or value is None:
      continue
    if side == "buy" and value <= 0:
      continue
    if side == "sell" and value >= 0:
      continue
    rows.append((symbol, value))
  rows.sort(key=lambda item: abs(item[1]), reverse=True)
  output = []
  for symbol, value in rows[:top]:
    formatted = format_billion(value)
    output.append(f"{symbol} ({formatted})" if formatted else symbol)
  return output


def fetch_flow(exchange: str, method_name: str) -> tuple[list[dict[str, Any]], str | None]:
  try:
    from vnstock_data.ui.insights import FlowInsights

    flow = FlowInsights()
    df = getattr(flow, method_name)(exchange=exchange, group_by="stock")
    return df_to_records(df), None
  except Exception as exc:
    return [], str(exc)[:180]


def fetch_contribution(exchange: str) -> tuple[list[dict[str, Any]], str | None]:
  try:
    from vnstock_data.ui.insights import SentimentInsights

    df = SentimentInsights().contribution(exchange=exchange)
    records = []
    for row in df_to_records(df):
      symbol = row_symbol(row)
      point = number_value(row.get("point") or row.get("value"))
      if not symbol or point is None:
        continue
      records.append({
        "exchange": exchange,
        "symbol": symbol,
        "point": point,
        "type": row.get("type"),
        "time": str(row.get("time")) if row.get("time") is not None else None,
      })
    return records, None
  except Exception as exc:
    return [], str(exc)[:180]


def clean_text(value: Any, max_len: int = 900) -> str:
  text = str(value or "").replace("\n", " ").replace("\r", " ")
  text = " ".join(text.split())
  return text[:max_len]


def classify_news_category(site: str, title: str, summary: str) -> str:
  text = f"{site} {title} {summary}".lower()
  global_keywords = ("fed", "mỹ", "trung quốc", "châu âu", "dầu", "vàng", "usd", "lãi suất mỹ", "quốc tế")
  macro_keywords = ("vĩ mô", "lãi suất", "tỷ giá", "tín dụng", "ngân hàng nhà nước", "gdp", "cpi", "lạm phát", "xuất khẩu")
  if any(keyword in text for keyword in global_keywords):
    return "global"
  if any(keyword in text for keyword in macro_keywords) or site in {"vneconomy", "thoibaotaichinhvietnam", "baodautu"}:
    return "macro"
  return "market"


def fetch_vnstock_news(limit: int = 36) -> tuple[list[dict[str, Any]], list[str]]:
  ok, errors = ensure_packages()
  if not ok:
    return [], errors

  from vnstock_news import Crawler

  sites = ["cafef", "vietstock", "vneconomy", "nguoiquansat", "baodautu", "vnexpress"]
  per_site = max(3, min(10, limit // max(1, len(sites)) + 1))
  fetched_at = now_iso()
  articles: list[dict[str, Any]] = []
  crawl_errors: list[str] = []

  for site in sites:
    if len(articles) >= limit:
      break
    try:
      crawler = Crawler(site_name=site)
      latest = crawler.get_latest_articles(limit=per_site)
    except Exception as exc:
      crawl_errors.append(f"{site}:latest:{str(exc)[:120]}")
      continue

    for entry in latest:
      if len(articles) >= limit:
        break
      url = entry.get("url") if isinstance(entry, dict) else None
      if not url:
        continue
      try:
        details = crawler.get_article_details(url)
      except Exception as exc:
        crawl_errors.append(f"{site}:detail:{str(exc)[:120]}")
        details = {}
      title = clean_text(details.get("title") or entry.get("title") or "")
      summary = clean_text(details.get("short_description") or details.get("summary") or details.get("content") or "")
      if len(title) < 12:
        continue
      category = classify_news_category(site, title, summary)
      articles.append({
        "source": "vnstock_news",
        "providerSite": site,
        "category": category,
        "title": title,
        "url": url,
        "summary": summary or None,
        "publishedAt": details.get("publish_time") or entry.get("lastmod"),
        "fetchedAt": fetched_at,
        "rawPayload": {
          "site": site,
          "url": url,
          "title": title,
          "summary": summary,
          "publish_time": details.get("publish_time"),
        },
      })

  return articles, crawl_errors


@app.get("/health")
def health() -> dict[str, Any]:
  ok, errors = ensure_packages()
  return {
    "ok": ok,
    "service": "vnstock-bridge",
    "checkedAt": now_iso(),
    "packages": {
      "vnstock_data": package_version("vnstock_data"),
      "vnstock_news": package_version("vnstock_news"),
      "vnstock_installer": package_version("vnstock_installer"),
    },
    "errors": errors,
  }


@app.get("/api/v1/eod-market-data")
def eod_market_data(
  date: str | None = Query(default=None),
  top: int = Query(default=10, ge=3, le=30),
) -> dict[str, Any]:
  ok, errors = ensure_packages()
  if not ok:
    raise HTTPException(status_code=503, detail={"message": "vnstock sponsor packages are not ready", "errors": errors})

  exchanges = ["HOSE", "HNX", "UPCOM"]
  status: dict[str, Any] = {}
  foreign_records: list[dict[str, Any]] = []
  prop_records: list[dict[str, Any]] = []
  active_records: list[dict[str, Any]] = []
  contribution_records: list[dict[str, Any]] = []

  for exchange in exchanges:
    foreign, foreign_error = fetch_flow(exchange, "foreign")
    prop, prop_error = fetch_flow(exchange, "proprietary")
    active, active_error = fetch_flow(exchange, "active")
    contribution, contribution_error = fetch_contribution(exchange)
    foreign_records.extend(foreign)
    prop_records.extend(prop)
    active_records.extend(active)
    contribution_records.extend(contribution)
    status[exchange] = {
      "foreignRows": len(foreign),
      "proprietaryRows": len(prop),
      "activeRows": len(active),
      "contributionRows": len(contribution),
      "errors": [err for err in [foreign_error, prop_error, active_error, contribution_error] if err],
    }

  foreign_top_buy = flow_items(foreign_records, "value_1d", "buy", top)
  foreign_top_sell = flow_items(foreign_records, "value_1d", "sell", top)
  prop_top_buy = flow_items(prop_records, "value_1d", "buy", top)
  prop_top_sell = flow_items(prop_records, "value_1d", "sell", top)
  active_top_buy = flow_items(active_records, "value_1d", "buy", top)
  active_top_sell = flow_items(active_records, "value_1d", "sell", top)

  missing_fields = []
  if not foreign_records:
    missing_fields.append("vnstock.foreign_flow")
  if not prop_records:
    missing_fields.append("vnstock.proprietary_flow")
  if not active_top_buy and not active_top_sell:
    missing_fields.append("vnstock.active_flow")
  if not contribution_records:
    missing_fields.append("vnstock.index_contribution")

  contribution_as_of = None
  contribution_times = [str(row.get("time")) for row in contribution_records if row.get("time")]
  if contribution_times:
    contribution_as_of = sorted(contribution_times)[-1]

  return {
    "date": date,
    "source": "vnstock_data",
    "retrievedAt": now_iso(),
    "contributionAsOf": contribution_as_of,
    "foreignTopBuy": foreign_top_buy,
    "foreignTopSell": foreign_top_sell,
    "propTradingTopBuy": prop_top_buy,
    "propTradingTopSell": prop_top_sell,
    "activeTopBuy": active_top_buy,
    "activeTopSell": active_top_sell,
    "indexContribution": contribution_records,
    "missingFields": missing_fields,
    "sourceStatus": status,
  }


@app.get("/api/v1/news/morning")
def morning_news(limit: int = Query(default=36, ge=6, le=80)) -> dict[str, Any]:
  articles, errors = fetch_vnstock_news(limit=limit)
  by_category: dict[str, int] = {}
  for item in articles:
    category = str(item.get("category") or "latest")
    by_category[category] = by_category.get(category, 0) + 1

  return {
    "ok": len(articles) > 0,
    "source": "vnstock_news",
    "retrievedAt": now_iso(),
    "articles": articles,
    "byCategory": by_category,
    "errors": errors,
    "missingFields": [] if articles else ["vnstock_news.articles"],
  }
