#!/usr/bin/env python3
"""
Generate ADN Lab backtest snapshot.

Scope:
- Offline historical backtest only.
- Does not publish signals, does not call Telegram, does not touch broker flow.
- Uses deterministic ADN Radar-style rules; AI is not involved.

Requirements:
  python -m pip install pandas vnstock
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from vnstock import Vnstock

warnings.filterwarnings("ignore")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


TICKER_SECTORS = {
    # Bank
    "VCB": "Ngan hang",
    "BID": "Ngan hang",
    "CTG": "Ngan hang",
    "TCB": "Ngan hang",
    "MBB": "Ngan hang",
    "ACB": "Ngan hang",
    "VPB": "Ngan hang",
    "STB": "Ngan hang",
    "HDB": "Ngan hang",
    "LPB": "Ngan hang",
    # Securities
    "SSI": "Chung khoan",
    "VND": "Chung khoan",
    "HCM": "Chung khoan",
    "VCI": "Chung khoan",
    "MBS": "Chung khoan",
    "VIX": "Chung khoan",
    "SHS": "Chung khoan",
    "ORS": "Chung khoan",
    "VDS": "Chung khoan",
    "TCI": "Chung khoan",
    "CTS": "Chung khoan",
    # Real estate / industrial park
    "VHM": "Bat dong san",
    "VIC": "Bat dong san",
    "VRE": "Bat dong san",
    "NVL": "Bat dong san",
    "PDR": "Bat dong san",
    "DXG": "Bat dong san",
    "DIG": "Bat dong san",
    "KBC": "Khu cong nghiep",
    "IDC": "Khu cong nghiep",
    "SZC": "Khu cong nghiep",
    # Materials / chemicals
    "HPG": "Thep",
    "HSG": "Thep",
    "NKG": "Thep",
    "DGC": "Hoa chat",
    "DCM": "Hoa chat",
    "DPM": "Hoa chat",
    "GVR": "Cao su",
    "AAA": "Nhua",
    "BMP": "Nhua",
    # Oil and gas
    "BSR": "Dau khi",
    "PVD": "Dau khi",
    "PVS": "Dau khi",
    "GAS": "Dau khi",
    "PLX": "Dau khi",
    # Retail / consumer
    "MWG": "Ban le",
    "FRT": "Ban le",
    "DGW": "Ban le",
    "MSN": "Tieu dung",
    "VNM": "Tieu dung",
    "SAB": "Tieu dung",
    # Tech / logistics / utilities
    "FPT": "Cong nghe",
    "CTR": "Cong nghe",
    "REE": "Tien ich",
    "PC1": "Tien ich",
    "POW": "Dien",
    "NT2": "Dien",
    "GMD": "Logistics",
    "HAH": "Logistics",
    "VJC": "Hang khong",
    "HVN": "Hang khong",
}

INITIAL_CAPITAL = int(os.getenv("BACKTEST_INITIAL_CAPITAL", "100000000"))
START_DATE = os.getenv("BACKTEST_START", "2018-01-01")
END_DATE = os.getenv("BACKTEST_END", datetime.now().strftime("%Y-%m-%d"))
DATA_SOURCE = os.getenv("BACKTEST_DATA_SOURCE", "KBS")
REQUEST_DELAY_SEC = float(os.getenv("BACKTEST_REQUEST_DELAY_SEC", "1.15"))

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "latest-backtest-snapshot.json"

COOLDOWN_DAYS = 5
T_PLUS = 3
RISK_PERCENT = 0.02
MKT_FLOOR_PCT = -0.065
MKT_VOL_SPIKE = 1.5
TRAIL_ACTIVATE = 0.15
TRAIL_PCT = 0.10
MIN_BARS = 220

TIER_CONFIG = {
    "LEADER": {"base_nav": 0.30, "target_pct": 0.20, "stop_pct": 0.07},
    "TRUNG_HAN": {"base_nav": 0.20, "target_pct": 0.10, "stop_pct": 0.05},
    "NGAN_HAN": {"base_nav": 0.10, "target_pct": 0.07, "stop_pct": 0.03},
    "TAM_NGAM": {"base_nav": 0.00, "target_pct": 0.10, "stop_pct": 0.05},
}

TYPE_TO_TIER = {
    "SIEU_CO_PHIEU": "LEADER",
    "TRUNG_HAN": "TRUNG_HAN",
    "DAU_CO": "NGAN_HAN",
    "TAM_NGAM": "TAM_NGAM",
}

MAX_HOLD_DAYS = {
    "LEADER": 120,
    "TRUNG_HAN": 80,
    "NGAN_HAN": 20,
}


def configured_tickers() -> list[str]:
    raw = os.getenv("BACKTEST_TICKERS")
    if not raw:
        return list(TICKER_SECTORS.keys())
    tickers = [x.strip().upper() for x in raw.split(",") if x.strip()]
    return list(dict.fromkeys(tickers))


TICKERS = configured_tickers()


def ema(s: pd.Series, span: int) -> pd.Series:
    return s.ewm(span=span, adjust=False).mean()


def rsi(s: pd.Series, length: int = 14) -> pd.Series:
    delta = s.diff()
    gain = delta.clip(lower=0).rolling(length).mean()
    loss = (-delta.clip(upper=0)).rolling(length).mean()
    rs = gain / loss.replace(0, pd.NA)
    return 100 - (100 / (1 + rs))


def macd(s: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    line = ema(s, 12) - ema(s, 26)
    signal = ema(line, 9)
    hist = line - signal
    return line, signal, hist


def atr(df: pd.DataFrame, length: int = 20) -> pd.Series:
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift()).abs()
    low_close = (df["low"] - df["close"].shift()).abs()
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.rolling(length).mean()


def is_derivatives_expiry_day(d: pd.Timestamp) -> bool:
    return d.weekday() == 3 and 15 <= d.day <= 21


def finite(value: Any) -> bool:
    try:
        return value is not None and math.isfinite(float(value))
    except Exception:
        return False


def get_data(symbol: str, start: str, end: str) -> pd.DataFrame | None:
    try:
        if REQUEST_DELAY_SEC > 0:
            time.sleep(REQUEST_DELAY_SEC)
        stock = Vnstock().stock(symbol=symbol, source=DATA_SOURCE)
        df = stock.quote.history(start=start, end=end)
        if df is None or df.empty:
            return None

        df.columns = [str(c).lower() for c in df.columns]
        df = df.rename(
            columns={
                "time": "date",
                "open": "open",
                "high": "high",
                "low": "low",
                "close": "close",
                "volume": "volume",
            }
        )
        if "date" not in df.columns:
            return None

        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.dropna(subset=["open", "high", "low", "close"]).ffill()
        df = df[~df.index.duplicated(keep="last")]
        return df
    except Exception as exc:
        print(f"  WARN: cannot fetch {symbol}: {exc}")
        return None


def prepare_stock(df: pd.DataFrame, df_mkt: pd.DataFrame | None) -> pd.DataFrame:
    df = df.copy()
    df["ema10"] = ema(df["close"], 10)
    df["ema20"] = ema(df["close"], 20)
    df["ema30"] = ema(df["close"], 30)
    df["ema50"] = ema(df["close"], 50)
    df["ema100"] = ema(df["close"], 100)
    df["ema200"] = ema(df["close"], 200)
    df["rsi14"] = rsi(df["close"], 14)
    df["macd"], df["macds"], df["macdh"] = macd(df["close"])
    df["vol_sma20"] = df["volume"].rolling(20).mean()
    df["atr20"] = atr(df, 20)
    df["high_20_prev"] = df["high"].rolling(20).max().shift(1)
    df["low_20_prev"] = df["low"].rolling(20).min().shift(1)
    df["range_20_pct"] = (df["high"].rolling(20).max() - df["low"].rolling(20).min()) / df["close"]
    df["range_60_pct"] = (df["high"].rolling(60).max() - df["low"].rolling(60).min()) / df["close"]
    df["low_60"] = df["low"].rolling(60).min()

    mid = df["close"].rolling(20).mean()
    std = df["close"].rolling(20).std()
    df["bb_upper"] = mid + 2 * std
    df["bb_lower"] = mid - 2 * std

    weekly = df[["close"]].resample("W").last().dropna()
    weekly["weekly_ma30"] = weekly["close"].rolling(30).mean()
    df["weekly_ma30"] = weekly["weekly_ma30"].reindex(df.index, method="ffill")

    if df_mkt is not None and not df_mkt.empty:
        market = df_mkt[["close", "volume"]].copy()
        market.columns = ["mkt_close", "mkt_volume"]
        market["mkt_ema20"] = ema(market["mkt_close"], 20)
        market["mkt_ema50"] = ema(market["mkt_close"], 50)
        market["mkt_vol_sma20"] = market["mkt_volume"].rolling(20).mean()
        market["mkt_prev_close"] = market["mkt_close"].shift(1)
        df = df.join(market, how="left").ffill()

    df["stock_ret_q"] = df["close"].pct_change(63)
    if "mkt_close" in df.columns:
        df["mkt_ret_q"] = df["mkt_close"].pct_change(63)
    else:
        df["mkt_ret_q"] = 0.0

    return df


def build_rs_ratings(stocks: dict[str, pd.DataFrame]) -> dict[pd.Timestamp, dict[str, int]]:
    all_dates = sorted(set(d for df in stocks.values() for d in df.index))
    ratings: dict[pd.Timestamp, dict[str, int]] = {}

    for date in all_dates:
        values: list[tuple[str, float]] = []
        for ticker, df in stocks.items():
            if date not in df.index:
                continue
            value = df.loc[date].get("stock_ret_q")
            if finite(value):
                values.append((ticker, float(value)))

        if not values:
            continue

        values.sort(key=lambda x: x[1])
        date_rating: dict[str, int] = {}
        if len(values) == 1:
            date_rating[values[0][0]] = 50
        else:
            for rank, (ticker, _value) in enumerate(values):
                date_rating[ticker] = int(round(1 + rank * 98 / (len(values) - 1)))
        ratings[date] = date_rating

    return ratings


def market_ok(curr: pd.Series) -> bool:
    if not finite(curr.get("mkt_close")) or not finite(curr.get("mkt_ema20")):
        return True
    return float(curr["mkt_close"]) > float(curr["mkt_ema20"])


def classify_adn_radar_signal(df: pd.DataFrame, idx: int, rs_rating: int) -> dict[str, Any] | None:
    curr = df.iloc[idx]
    prev = df.iloc[idx - 1]

    required = ["close", "open", "ema10", "ema20", "ema30", "ema50", "macd", "macds", "rsi14", "vol_sma20"]
    if any(not finite(curr.get(col)) for col in required):
        return None

    close = float(curr["close"])
    prev_close = float(prev["close"])
    volume = float(curr["volume"]) if finite(curr.get("volume")) else 0.0
    vol_sma20 = float(curr["vol_sma20"]) if finite(curr.get("vol_sma20")) and float(curr["vol_sma20"]) > 0 else 0.0
    vol_ratio = volume / vol_sma20 if vol_sma20 > 0 else 0.0
    day_gain = close / prev_close - 1 if prev_close > 0 else 0.0

    ema_stack = float(curr["ema10"]) > float(curr["ema20"]) > float(curr["ema50"])
    ema_medium = float(curr["ema10"]) > float(curr["ema30"]) and close > float(curr["ema20"])
    macd_positive = float(curr["macd"]) > float(curr["macds"])
    macd_cross_up = macd_positive and finite(prev.get("macd")) and finite(prev.get("macds")) and float(prev["macd"]) <= float(prev["macds"])
    rsi_value = float(curr["rsi14"])

    high_20_prev = float(curr["high_20_prev"]) if finite(curr.get("high_20_prev")) else None
    range_20 = float(curr["range_20_pct"]) if finite(curr.get("range_20_pct")) else None
    range_60 = float(curr["range_60_pct"]) if finite(curr.get("range_60_pct")) else None

    breakout_20 = high_20_prev is not None and close > high_20_prev and vol_ratio >= 1.3
    vcp_like = (
        range_20 is not None
        and range_60 is not None
        and range_20 <= min(range_60 * 0.75, 0.18)
        and close > float(curr["ema20"])
    )
    double_bottom_like = (
        finite(curr.get("low_60"))
        and float(curr["low_60"]) > 0
        and float(curr["low_20_prev"]) <= float(curr["low_60"]) * 1.08 if finite(curr.get("low_20_prev")) else False
    )
    bb_bounce = (
        finite(curr.get("bb_lower"))
        and float(curr["low"]) <= float(curr["bb_lower"]) * 1.02
        and close > float(curr["open"])
        and vol_ratio >= 1.2
        and rsi_value >= 30
    )

    if market_ok(curr) and rs_rating >= 85 and ema_stack and breakout_20 and vol_ratio >= 2.0:
        return {
            "type": "SIEU_CO_PHIEU",
            "tier": TYPE_TO_TIER["SIEU_CO_PHIEU"],
            "reason": "RS cao, breakout 20 phien, volume dot bien",
            "vol_ratio": vol_ratio,
            "rs_rating": rs_rating,
        }

    if market_ok(curr) and rs_rating >= 60 and ema_stack and (macd_cross_up or vcp_like or double_bottom_like) and vol_ratio >= 1.5:
        return {
            "type": "TRUNG_HAN",
            "tier": TYPE_TO_TIER["TRUNG_HAN"],
            "reason": "Xu huong EMA, MACD/VCP/W-base, volume xac nhan",
            "vol_ratio": vol_ratio,
            "rs_rating": rs_rating,
        }

    if market_ok(curr) and ema_medium and macd_positive and day_gain > 0 and vol_ratio >= 1.2 and 35 <= rsi_value <= 75:
        return {
            "type": "DAU_CO",
            "tier": TYPE_TO_TIER["DAU_CO"],
            "reason": "Song ngan han, EMA 10/30, MACD duong, volume cai thien",
            "vol_ratio": vol_ratio,
            "rs_rating": rs_rating,
        }

    if market_ok(curr) and rs_rating >= 50 and (vcp_like or bb_bounce or double_bottom_like) and close >= float(curr["ema20"]) * 0.97:
        return {
            "type": "TAM_NGAM",
            "tier": TYPE_TO_TIER["TAM_NGAM"],
            "reason": "Dang trong tam ngam, cho xac nhan volume/gia",
            "vol_ratio": vol_ratio,
            "rs_rating": rs_rating,
        }

    return None


def floor_lot(shares: float) -> int:
    return max(0, int(shares // 100) * 100)


def backtest_portfolio(stocks: dict[str, pd.DataFrame]) -> dict[str, Any]:
    all_dates = sorted(set(d for df in stocks.values() for d in df.index))
    if len(all_dates) < 2:
        return {}

    rs_ratings = build_rs_ratings(stocks)
    cash = float(INITIAL_CAPITAL)
    positions: dict[str, dict[str, Any]] = {}
    cooldowns: dict[str, int] = {}
    all_trades: list[dict[str, Any]] = []
    trades_by_ticker: dict[str, list[float]] = {ticker: [] for ticker in stocks}
    signal_counts = {"SIEU_CO_PHIEU": 0, "TRUNG_HAN": 0, "DAU_CO": 0, "TAM_NGAM": 0}
    equity_daily: dict[str, float] = {}
    peak_equity = float(INITIAL_CAPITAL)
    max_dd = 0.0

    for day_i in range(1, len(all_dates)):
        date = all_dates[day_i]

        leader_cb = False
        if not is_derivatives_expiry_day(date):
            for _ticker, _df in stocks.items():
                if date not in _df.index:
                    continue
                row = _df.loc[date]
                if finite(row.get("mkt_prev_close")) and finite(row.get("mkt_close")):
                    prev_mkt = float(row["mkt_prev_close"])
                    mkt_chg = (float(row["mkt_close"]) - prev_mkt) / prev_mkt if prev_mkt > 0 else 0
                    if mkt_chg <= MKT_FLOOR_PCT:
                        leader_cb = True
                    if (
                        finite(row.get("mkt_ema20"))
                        and finite(row.get("mkt_vol_sma20"))
                        and float(row["mkt_close"]) < float(row["mkt_ema20"])
                        and float(row["mkt_volume"]) > float(row["mkt_vol_sma20"]) * MKT_VOL_SPIKE
                    ):
                        leader_cb = True
                break

        # Sell first.
        to_close: list[str] = []
        for ticker, pos in list(positions.items()):
            df = stocks[ticker]
            if date not in df.index:
                continue
            curr = df.loc[date]
            close = float(curr["close"])
            pos["pos_peak"] = max(float(pos["pos_peak"]), close)
            days_held = day_i - int(pos["buy_day_i"])

            exit_price = None
            exit_reason = None

            if float(curr["low"]) <= float(pos["stoploss"]):
                exit_price = float(pos["stoploss"])
                exit_reason = "stoploss"
            elif float(curr["high"]) >= float(pos["target"]):
                exit_price = float(pos["target"])
                exit_reason = "target"
            elif leader_cb:
                exit_price = close
                exit_reason = "market_risk"
            else:
                peak_gain = (float(pos["pos_peak"]) - float(pos["buy_p"])) / float(pos["buy_p"])
                trail_fall = (close - float(pos["pos_peak"])) / float(pos["pos_peak"]) if float(pos["pos_peak"]) > 0 else 0
                max_hold = MAX_HOLD_DAYS.get(str(pos["tier"]), 60)
                weak_after_t = days_held >= T_PLUS and finite(curr.get("ema20")) and close < float(curr["ema20"])
                timed_out = days_held >= max_hold and finite(curr.get("ema10")) and close < float(curr["ema10"])
                if peak_gain >= TRAIL_ACTIVATE and trail_fall <= -TRAIL_PCT:
                    exit_price = close
                    exit_reason = "trailing_stop"
                elif weak_after_t:
                    exit_price = close
                    exit_reason = "lost_ema20"
                elif timed_out:
                    exit_price = close
                    exit_reason = "time_exit"

            if exit_price is not None:
                proceed = float(pos["shares"]) * exit_price
                cost = float(pos["shares"]) * float(pos["buy_p"])
                pnl_pct = (exit_price - float(pos["buy_p"])) / float(pos["buy_p"])
                cash += proceed
                all_trades.append(
                    {
                        "ticker": ticker,
                        "type": pos["type"],
                        "tier": pos["tier"],
                        "entry_date": pos["entry_date"],
                        "exit_date": date.strftime("%Y-%m-%d"),
                        "entry": round(float(pos["buy_p"]), 2),
                        "exit": round(exit_price, 2),
                        "shares": int(pos["shares"]),
                        "pnl_pct": pnl_pct,
                        "pnl_value": proceed - cost,
                        "reason": exit_reason,
                    }
                )
                trades_by_ticker[ticker].append(pnl_pct)
                to_close.append(ticker)
                cooldowns[ticker] = COOLDOWN_DAYS

        for ticker in to_close:
            del positions[ticker]

        unrealized = sum(
            float(pos["shares"]) * float(stocks[ticker].loc[date, "close"])
            for ticker, pos in positions.items()
            if date in stocks[ticker].index
        )
        total_equity = cash + unrealized

        # Buy with ADN Radar deterministic selection style.
        date_rs = rs_ratings.get(date, {})
        for ticker, df in stocks.items():
            if ticker in positions or date not in df.index:
                continue
            idx = df.index.get_loc(date)
            if idx < MIN_BARS or leader_cb:
                continue
            if cooldowns.get(ticker, 0) > 0:
                cooldowns[ticker] -= 1
                continue

            signal = classify_adn_radar_signal(df, idx, date_rs.get(ticker, 0))
            if not signal:
                continue
            signal_counts[signal["type"]] += 1
            if signal["type"] == "TAM_NGAM":
                continue

            curr = df.iloc[idx]
            entry = float(curr["close"])
            tier_cfg = TIER_CONFIG[signal["tier"]]
            target = entry * (1 + tier_cfg["target_pct"])
            stoploss = entry * (1 - tier_cfg["stop_pct"])
            risk_per_share = entry - stoploss
            if entry <= 0 or risk_per_share <= 0:
                continue

            max_by_risk = (total_equity * RISK_PERCENT) / risk_per_share
            max_by_nav = (total_equity * tier_cfg["base_nav"]) / entry
            max_by_cash = cash / entry
            shares = floor_lot(min(max_by_risk, max_by_nav, max_by_cash))
            cost = shares * entry

            if shares >= 100 and cash >= cost:
                cash -= cost
                positions[ticker] = {
                    "shares": shares,
                    "buy_p": entry,
                    "target": target,
                    "stoploss": stoploss,
                    "pos_peak": entry,
                    "buy_day_i": day_i,
                    "entry_date": date.strftime("%Y-%m-%d"),
                    "type": signal["type"],
                    "tier": signal["tier"],
                    "rs_rating": signal["rs_rating"],
                    "vol_ratio": signal["vol_ratio"],
                    "reason": signal["reason"],
                }
                total_equity = cash + sum(
                    float(p["shares"]) * float(stocks[tk].loc[date, "close"])
                    for tk, p in positions.items()
                    if date in stocks[tk].index
                )

        current_equity = cash + sum(
            float(pos["shares"]) * float(stocks[ticker].loc[date, "close"])
            for ticker, pos in positions.items()
            if date in stocks[ticker].index
        )
        peak_equity = max(peak_equity, current_equity)
        drawdown = (peak_equity - current_equity) / peak_equity if peak_equity > 0 else 0
        max_dd = max(max_dd, drawdown)
        equity_daily[date.strftime("%Y-%m-%d")] = current_equity

    final_date = all_dates[-1]
    final_equity = cash + sum(
        float(pos["shares"]) * float(stocks[ticker].loc[final_date, "close"])
        for ticker, pos in positions.items()
        if final_date in stocks[ticker].index
    )

    wins = [trade for trade in all_trades if trade["pnl_pct"] > 0]
    win_rate = len(wins) / len(all_trades) * 100 if all_trades else 0
    total_return = (final_equity - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100

    ticker_stats = {}
    for ticker, trades in trades_by_ticker.items():
        if not trades:
            continue
        ticker_stats[ticker] = {
            "num_trades": len(trades),
            "win_rate": round(len([x for x in trades if x > 0]) / len(trades) * 100, 1),
            "avg_return": round(sum(trades) / len(trades) * 100, 2),
        }

    return {
        "balance": final_equity,
        "total_return": total_return,
        "win_rate": win_rate,
        "max_drawdown": max_dd * 100,
        "num_trades": len(all_trades),
        "multiplier": round(final_equity / INITIAL_CAPITAL, 2),
        "equity_daily": equity_daily,
        "ticker_stats": ticker_stats,
        "signal_counts": signal_counts,
        "sample_trades": all_trades[-30:],
    }


def build_monthly_equity(equity_daily: dict[str, float]) -> tuple[list[dict[str, Any]], float]:
    series = pd.Series(equity_daily, dtype=float)
    series.index = pd.to_datetime(series.index)
    series = series.sort_index()
    if series.empty:
        return [], 0.0

    normalized = series / series.iloc[0] * 100 if series.iloc[0] > 0 else series
    peak = normalized.expanding().max()
    max_dd_pct = ((peak - normalized) / peak).max() * 100
    monthly = normalized.resample("ME").last().dropna()
    return [{"date": dt.strftime("%m/%Y"), "adn": round(value, 1)} for dt, value in monthly.items()], max_dd_pct


def vnindex_monthly(df_mkt: pd.DataFrame | None) -> dict[str, float]:
    if df_mkt is None or df_mkt.empty:
        return {}
    monthly = df_mkt["close"].resample("ME").last().dropna()
    if monthly.empty:
        return {}
    normalized = monthly / monthly.iloc[0] * 100 if monthly.iloc[0] > 0 else monthly
    return {dt.strftime("%m/%Y"): round(value, 1) for dt, value in normalized.items()}


def main() -> None:
    print(f"ADN Lab backtest: {START_DATE} -> {END_DATE}")
    print(f"Initial capital: {INITIAL_CAPITAL:,.0f} VND")
    print(f"Universe: {len(TICKERS)} tickers")
    print(f"Data source: {DATA_SOURCE}")
    print("=" * 72)

    df_mkt = get_data("VNINDEX", START_DATE, END_DATE)
    if df_mkt is None:
        print("WARN: VNINDEX unavailable, market filter will be relaxed.")

    prepared: dict[str, pd.DataFrame] = {}
    skipped: list[str] = []

    for ticker in TICKERS:
        sector = TICKER_SECTORS.get(ticker, "Khac")
        print(f"  {ticker:<4} {sector:<16}", end=" ")
        df = get_data(ticker, START_DATE, END_DATE)
        if df is None or len(df) < MIN_BARS:
            print("SKIP")
            skipped.append(ticker)
            continue
        prepared[ticker] = prepare_stock(df, df_mkt)
        print(f"{len(df)} bars")

    if not prepared:
        raise SystemExit("No ticker data available. Snapshot not generated.")

    print("=" * 72)
    print(f"Running deterministic ADN Radar-style backtest on {len(prepared)} tickers...")
    result = backtest_portfolio(prepared)
    if not result:
        raise SystemExit("Backtest failed. Snapshot not generated.")

    chart_adn, portfolio_dd = build_monthly_equity(result["equity_daily"])
    vni = vnindex_monthly(df_mkt)

    chart_data: list[dict[str, Any]] = []
    for point in chart_adn:
        item = {"date": point["date"], "adn": point["adn"]}
        if point["date"] in vni:
            item["vnindex"] = vni[point["date"]]
        chart_data.append(item)

    snapshot = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "period": f"{START_DATE[:4]}-{END_DATE[:4]}",
        "start_year": int(START_DATE[:4]),
        "end_year": int(END_DATE[:4]),
        "initial_capital": INITIAL_CAPITAL,
        "strategy": {
            "name": "ADN Radar deterministic selection",
            "signal_types": ["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO", "TAM_NGAM"],
            "traded_types": ["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO"],
            "risk_model": {
                "LEADER": TIER_CONFIG["LEADER"],
                "TRUNG_HAN": TIER_CONFIG["TRUNG_HAN"],
                "NGAN_HAN": TIER_CONFIG["NGAN_HAN"],
            },
        },
        "tickers": sorted(prepared.keys()),
        "skipped_tickers": skipped,
        "kpi": {
            "total_return": round(result["total_return"], 1),
            "win_rate": round(result["win_rate"], 1),
            "max_drawdown": round(portfolio_dd, 1),
            "total_trades": result["num_trades"],
            "multiplier": result["multiplier"],
        },
        "signal_counts": result["signal_counts"],
        "ticker_stats": result["ticker_stats"],
        "sample_trades": result["sample_trades"],
        "chart_data": chart_data,
        "annotations": {
            "cb_on": None,
            "cb_off": None,
            "bear_label": "ADN Radar risk guard reduces exposure when market risk expands.",
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
        json.dump(snapshot, file, ensure_ascii=False, indent=2)

    print("=" * 72)
    print(f"Snapshot written: {OUTPUT_PATH}")
    print(f"Final equity: {result['balance']:,.0f} VND")
    print(f"Total return: {result['total_return']:.1f}%")
    print(f"Winrate: {result['win_rate']:.1f}%")
    print(f"Max drawdown: {portfolio_dd:.1f}%")
    print(f"Total trades: {result['num_trades']}")
    print(f"Signal counts: {result['signal_counts']}")
    print(f"Chart points: {len(chart_data)}")


if __name__ == "__main__":
    main()
