#!/usr/bin/env python3
"""
generate-backtest-snapshot.py  ─  V5-PRO
─────────────────────────────────────────
Backtest V5-PRO (ADN Capital) 2015–2025
PORTFOLIO-LEVEL Dynamic Compounding.
10 cổ phiếu chia sẻ 1 pool vốn 100 triệu VNĐ.
Risk-based Position Sizing: N = (Equity × 1.5%) / (Price × |SL|)

Yêu cầu: pip install vnstock pandas pandas_ta
"""

import json, warnings
from datetime import datetime
from pathlib import Path

import pandas as pd
import pandas_ta as ta
from vnstock import Vnstock

warnings.filterwarnings("ignore")

# ══ Config ════════════════════════════════════════════════════════════
TICKER_SECTORS = {
    "FPT": "Công nghệ",
    "HPG": "Thép/Vật liệu",
    "VCB": "Ngân hàng",
    "DGC": "Hoá chất/XK",
    "PVD": "Dầu khí",
    "PVS": "Dầu khí DV",
    "SSI": "Chứng khoán",
    "VCG": "Xây dựng",
    "REE": "Tiện ích/Điện",
    "MWG": "Bán lẻ",
}
TICKERS = list(TICKER_SECTORS.keys())
INITIAL_CAPITAL = 100_000_000  # 100 triệu VNĐ
START_DATE = "2015-01-01"
END_DATE   = "2025-12-31"

SCRIPT_DIR  = Path(__file__).resolve().parent
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "data" / "latest-backtest-snapshot.json"

# ══ Strategy Parameters V5-PRO ════════════════════════════════════════════
COOLDOWN_DAYS    = 5          # V5-PRO+: giảm 10→5 để vào lại nhanh
T_PLUS           = 3
STOP_LOSS_PCT    = -0.07
FLOOR_PCT        = -0.065
MKT_VOL_SPIKE    = 1.5
TRAIL_ACTIVATE   = 0.15       # Trailing kích hoạt khi lãi ≥ 15%
TRAIL_PCT        = 0.10       # Trail 10% từ đỉnh
RISK_PERCENT     = 0.04       # 4% NAV mỗi lệnh
MAX_POS_PCT      = 0.25       # Tối đa 25% NAV/lệnh (4 vị thế cùng lúc)
VOLUME_BREAKOUT  = 1.0        # V5-PRO+: hạ 1.5→1.0 cho nhiều cơ hội
PARTIAL_TP_PCT   = 0.08       # Chốt 50% tại +8%
PARTIAL_TP_RATIO = 0.50
BREAKOUT_PCT     = 1.005      # V5-PRO+: hạ 1.015→1.005 (close > prev * 0.5%)


# ── Helper: Ngày đáo hạn phái sinh (Thứ 5 tuần 3) ──────────────────────
def is_derivatives_expiry_day(d) -> bool:
    if isinstance(d, pd.Timestamp):
        d = d.to_pydatetime()
    if d.weekday() != 3:
        return False
    return 15 <= d.day <= 21


# ── Lấy dữ liệu ─────────────────────────────────────────────────────
def get_data(symbol: str, start: str, end: str) -> pd.DataFrame | None:
    try:
        stock = Vnstock().stock(symbol=symbol, source="KBS")
        df = stock.quote.history(start=start, end=end)
        if df is None or df.empty:
            return None
        df.columns = [c.lower() for c in df.columns]
        df = df.rename(columns={
            "time": "date", "open": "open", "high": "high",
            "low": "low", "close": "close", "volume": "volume",
        })
        df["date"] = pd.to_datetime(df["date"])
        df.set_index("date", inplace=True)
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.sort_index().ffill()
        df = df[~df.index.duplicated(keep="last")]
        return df
    except Exception as e:
        print(f"  ⚠ Không lấy được dữ liệu {symbol}: {e}")
        return None


# ── Thêm indicators vào DF của 1 mã ────────────────────────────────────
def prepare_stock(df: pd.DataFrame, df_mkt: pd.DataFrame | None) -> pd.DataFrame:
    df = df.copy()
    df["ema10"] = ta.ema(df["close"], length=10)
    df["ema20"] = ta.ema(df["close"], length=20)
    df["ema30"] = ta.ema(df["close"], length=30)
    macd = ta.macd(df["close"])
    df["macd"], df["macds"] = macd.iloc[:, 0], macd.iloc[:, 2]
    df["vol_sma20"] = df["volume"].rolling(window=20).mean()
    df["atr20"] = ta.atr(df["high"], df["low"], df["close"], length=20)

    # Weekly MA30 (Multi-Timeframe)
    wk = df[["close"]].resample("W").last().dropna()
    wk["wk_ma30"] = wk["close"].rolling(30).mean()
    df["weekly_ma30"] = wk["wk_ma30"].reindex(df.index, method="ffill")

    # Market join
    if df_mkt is not None:
        mc = df_mkt[["close", "volume"]].copy()
        mc.columns = ["mkt_close", "mkt_volume"]
        mc["mkt_ema50"]     = ta.ema(mc["mkt_close"], length=50)
        mc["mkt_ema20"]     = ta.ema(mc["mkt_close"], length=20)
        mc["mkt_vol_sma20"] = mc["mkt_volume"].rolling(window=20).mean()
        mc["mkt_prev_close"] = mc["mkt_close"].shift(1)
        df = df.join(mc, how="left").ffill()

    # RS Rating (3-month relative strength)
    df["stock_ret_q"] = df["close"].pct_change(63)
    if "mkt_close" in df.columns:
        df["mkt_ret_q"] = df["mkt_close"].pct_change(63)
    else:
        df["mkt_ret_q"] = 0.0

    return df


# ══ Portfolio-level Backtest V5-PRO ═══════════════════════════════════════
def backtest_portfolio(stocks: dict[str, pd.DataFrame]) -> dict:
    """
    10 cổ phiếu chia sẻ 1 pool vốn 100 triệu.
    Dynamic Compounding: N = (Equity × 1.5%) / (Price × |SL|)
    Full reinvestment: lãi chốt → cộng dồn cash → lãi kép.
    """
    # Unified timeline
    all_dates = sorted(set(d for df in stocks.values() for d in df.index))
    if len(all_dates) < 2:
        return {}

    cash = float(INITIAL_CAPITAL)
    positions = {}    # {ticker: {shares, buy_p, pos_peak, buy_day_i, partial_tp, orig_shares}}
    cooldowns = {}    # {ticker: remaining_days}
    all_trades = []
    trades_by_ticker = {t: [] for t in stocks}
    equity_daily = {}
    peak_equity = float(INITIAL_CAPITAL)
    max_dd = 0.0

    for day_i in range(1, len(all_dates)):
        date = all_dates[day_i]

        # ══ Leader Floor Detection (global, once per day) ══
        leader_cb = False
        is_expiry = is_derivatives_expiry_day(date)

        for _t, _df in stocks.items():
            if date not in _df.index or "mkt_close" not in _df.columns:
                continue
            _curr = _df.loc[date]
            mpc = _curr.get("mkt_prev_close")
            if pd.notna(mpc) and pd.notna(_curr["mkt_close"]) and mpc > 0:
                mkt_chg = (_curr["mkt_close"] - mpc) / mpc
                if mkt_chg <= FLOOR_PCT and not is_expiry:
                    leader_cb = True

                _prev_date = all_dates[day_i - 1]
                if _prev_date in _df.index:
                    _prev = _df.loc[_prev_date]
                    if (not is_expiry
                        and pd.notna(_curr.get("mkt_ema20"))
                        and pd.notna(_prev.get("mkt_close"))
                        and pd.notna(_prev.get("mkt_ema20"))
                        and _prev["mkt_close"] >= _prev["mkt_ema20"]
                        and _curr["mkt_close"] < _curr["mkt_ema20"]
                        and pd.notna(_curr.get("mkt_vol_sma20"))
                        and _curr["mkt_vol_sma20"] > 0
                        and _curr["mkt_volume"] > _curr["mkt_vol_sma20"] * MKT_VOL_SPIKE):
                        leader_cb = True
            break  # Only need 1 stock for market check

        # ══ PHASE 1: SELL (free up cash before buying) ══
        to_close = []
        for ticker in list(positions.keys()):
            df = stocks[ticker]
            if date not in df.index:
                continue
            pos = positions[ticker]
            idx = df.index.get_loc(date)
            if idx == 0:
                continue
            curr = df.iloc[idx]

            pnl_pct = (curr["close"] - pos["buy_p"]) / pos["buy_p"]
            days_held = day_i - pos["buy_day_i"]
            if curr["close"] > pos["pos_peak"]:
                pos["pos_peak"] = curr["close"]

            # Partial Take Profit ─ chốt 50% tại +8%
            if not pos["partial_tp"] and pnl_pct >= PARTIAL_TP_PCT:
                sell_qty = int(pos["shares"] * PARTIAL_TP_RATIO)
                if sell_qty > 0:
                    proceed = sell_qty * curr["close"]
                    cost_b  = sell_qty * pos["buy_p"]
                    pnl_r = (proceed - cost_b) / (pos["orig_shares"] * pos["buy_p"]) if (pos["orig_shares"] * pos["buy_p"]) > 0 else 0
                    cash += proceed       # Tiền về túi ngay -> reinvest
                    pos["shares"] -= sell_qty
                    all_trades.append(pnl_r)
                    trades_by_ticker[ticker].append(pnl_r)
                    pos["partial_tp"] = True

            # Sell conditions
            trail_fp = (curr["close"] - pos["pos_peak"]) / pos["pos_peak"] if pos["pos_peak"] > 0 else 0
            trail_trig = (
                (pos["pos_peak"] - pos["buy_p"]) / pos["buy_p"] >= TRAIL_ACTIVATE
                and trail_fp <= -TRAIL_PCT
            )

            sold = False
            if leader_cb:
                sold = True
            elif pnl_pct <= STOP_LOSS_PCT:
                sold = True
            elif trail_trig:
                sold = True
            elif days_held >= T_PLUS and curr["close"] < curr["ema20"]:
                sold = True

            if sold:
                proceed = pos["shares"] * curr["close"]
                cost_b  = pos["shares"] * pos["buy_p"]
                pnl_r = (proceed - cost_b) / (pos["orig_shares"] * pos["buy_p"]) if (pos["orig_shares"] * pos["buy_p"]) > 0 else 0
                cash += proceed           # Full reinvestment
                all_trades.append(pnl_r)
                trades_by_ticker[ticker].append(pnl_r)
                to_close.append(ticker)
                cooldowns[ticker] = COOLDOWN_DAYS

        for t in to_close:
            del positions[t]

        # Recalculate equity after sells
        unrealized = 0.0
        for t, pos in positions.items():
            if date in stocks[t].index:
                unrealized += pos["shares"] * stocks[t].loc[date, "close"]
        total_equity = cash + unrealized

        # ══ PHASE 2: BUY ══
        for ticker, df in stocks.items():
            if ticker in positions:
                continue
            if date not in df.index:
                continue
            idx = df.index.get_loc(date)
            if idx == 0:
                continue

            # Cooldown (giảm mỗi ngày giao dịch của mã này)
            if cooldowns.get(ticker, 0) > 0:
                cooldowns[ticker] -= 1
                continue
            if leader_cb:
                continue

            curr = df.iloc[idx]
            prev = df.iloc[idx - 1]

            v_gap = curr["volume"] / curr["vol_sma20"] if pd.notna(curr["vol_sma20"]) and curr["vol_sma20"] > 0 else 0
            mkt_ok = True
            if "mkt_close" in curr.index and "mkt_ema50" in curr.index:
                if pd.notna(curr["mkt_close"]) and pd.notna(curr["mkt_ema50"]):
                    mkt_ok = curr["mkt_close"] > curr["mkt_ema50"]

            weekly_ok = pd.notna(curr.get("weekly_ma30")) and curr["close"] > curr["weekly_ma30"]
            rs_ok = (
                pd.notna(curr.get("stock_ret_q"))
                and pd.notna(curr.get("mkt_ret_q"))
                and curr["stock_ret_q"] > curr["mkt_ret_q"]
                and curr["stock_ret_q"] > 0
            )

            if (mkt_ok and weekly_ok and rs_ok
                and curr["ema10"] > curr["ema30"]
                and curr["macd"] > curr["macds"]
                and curr["close"] > prev["close"] * BREAKOUT_PCT
                and v_gap >= VOLUME_BREAKOUT):

                # V5-PRO: Dynamic Compounding Position Sizing
                # N = (Equity × Risk%) / (Price × |SL%|)
                sl_amount = curr["close"] * abs(STOP_LOSS_PCT)
                raw_n = (total_equity * RISK_PERCENT) / sl_amount if sl_amount > 0 else 0
                max_n = (total_equity * MAX_POS_PCT) / curr["close"] if curr["close"] > 0 else 0
                n_shares = int(min(raw_n, max_n))
                n_shares = (n_shares // 100) * 100   # Lô 100 (sàn VN)
                cost = n_shares * curr["close"]

                if n_shares >= 100 and cash >= cost:
                    cash -= cost
                    positions[ticker] = {
                        "shares": n_shares,
                        "buy_p": curr["close"],
                        "pos_peak": curr["close"],
                        "buy_day_i": day_i,
                        "partial_tp": False,
                        "orig_shares": n_shares,
                    }
                    # Update total_equity after buy
                    total_equity = cash + sum(
                        p["shares"] * stocks[tk].loc[date, "close"]
                        for tk, p in positions.items()
                        if date in stocks[tk].index
                    )

        # ══ Track equity ══
        unrealized = 0.0
        for t, pos in positions.items():
            if date in stocks[t].index:
                unrealized += pos["shares"] * stocks[t].loc[date, "close"]
        cur_eq = cash + unrealized

        if cur_eq > peak_equity:
            peak_equity = cur_eq
        dd = (peak_equity - cur_eq) / peak_equity if peak_equity > 0 else 0
        if dd > max_dd:
            max_dd = dd

        equity_daily[date.strftime("%Y-%m-%d")] = cur_eq

    # Final: liquidate remaining positions
    final_eq = cash
    for t, pos in positions.items():
        final_eq += pos["shares"] * stocks[t].iloc[-1]["close"]

    wins = [x for x in all_trades if x > 0]
    win_rate = (len(wins) / len(all_trades) * 100) if all_trades else 0
    total_return = ((final_eq - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100
    multiplier = final_eq / INITIAL_CAPITAL

    # Per-ticker stats
    ticker_stats = {}
    for t, trd in trades_by_ticker.items():
        if trd:
            w = [x for x in trd if x > 0]
            ticker_stats[t] = {
                "num_trades": len(trd),
                "win_rate": round(len(w) / len(trd) * 100, 0),
            }

    return {
        "balance": final_eq,
        "total_return": total_return,
        "win_rate": win_rate,
        "max_drawdown": max_dd * 100,
        "num_trades": len(all_trades),
        "multiplier": round(multiplier, 1),
        "equity_daily": equity_daily,
        "ticker_stats": ticker_stats,
    }


# ── Equity curve monthly (single portfolio) ──────────────────────────
def build_monthly_equity(equity_daily: dict[str, float]) -> tuple[list[dict], float]:
    """Convert daily equity → monthly + compute portfolio max DD."""
    s = pd.Series(equity_daily, dtype=float)
    s.index = pd.to_datetime(s.index)
    s = s.sort_index()
    if s.empty:
        return [], 0.0

    # Normalize from 100
    first = s.iloc[0]
    if first and first > 0:
        s_norm = s / first * 100
    else:
        s_norm = s

    # Portfolio max drawdown
    peak = s_norm.expanding().max()
    dd_series = (peak - s_norm) / peak
    max_dd_pct = dd_series.max() * 100

    # Monthly resample
    monthly = s_norm.resample("ME").last().dropna()
    result = [{"date": dt.strftime("%m/%Y"), "adn": round(v, 1)} for dt, v in monthly.items()]

    return result, max_dd_pct


# ── VNINDEX benchmark ──────────────────────────────────────────────
def get_vnindex_monthly(start: str, end: str) -> dict[str, float]:
    try:
        idx = Vnstock().stock(symbol="VNINDEX", source="KBS")
        df = idx.quote.history(start=start, end=end)
        if df is None or df.empty:
            return {}
        df.columns = [c.lower() for c in df.columns]
        df = df.rename(columns={"time": "date", "close": "close"})
        df["date"] = pd.to_datetime(df["date"])
        df.set_index("date", inplace=True)
        df["close"] = pd.to_numeric(df["close"], errors="coerce")
        monthly = df["close"].resample("ME").last().dropna()
        first = monthly.iloc[0]
        if first and first > 0:
            monthly = monthly / first * 100
        return {dt.strftime("%m/%Y"): round(v, 1) for dt, v in monthly.items()}
    except Exception as e:
        print(f"  ⚠ Không lấy được VNINDEX: {e}")
        return {}


# ══ Main ════════════════════════════════════════════════════════════════
def main():
    print(f"🚀 Backtest V5-PRO Portfolio: {START_DATE} → {END_DATE}")
    print(f"   💰 Vốn ban đầu: {INITIAL_CAPITAL:,.0f} VNĐ")
    print(f"   Risk/lệnh: {RISK_PERCENT*100:.1f}% NAV | SL: {STOP_LOSS_PCT*100:.0f}% | Max pos: {MAX_POS_PCT*100:.0f}% NAV")
    print(f"   Danh mục: {TICKERS}")
    print("=" * 60)

    # Market index
    df_mkt = get_data("E1VFVN30", START_DATE, END_DATE)

    # Prepare all stocks
    prepared = {}
    for ticker in TICKERS:
        sector = TICKER_SECTORS.get(ticker, "?")
        print(f"  📊 {ticker} ({sector})...", end=" ")
        df = get_data(ticker, START_DATE, END_DATE)
        if df is None or len(df) < 60:
            print("SKIP")
            continue
        prepared[ticker] = prepare_stock(df, df_mkt)
        print(f"{len(df)} bars OK")

    if not prepared:
        print("❌ Không có mã nào chạy được!")
        return

    # Run portfolio backtest
    print(f"\n  🎯 Running portfolio backtest ({len(prepared)} stocks)...")
    result = backtest_portfolio(prepared)

    if not result:
        print("❌ Backtest failed!")
        return

    # Print per-ticker stats
    print("\n  ─── Per-Ticker Stats ───")
    for t in TICKERS:
        if t in result.get("ticker_stats", {}):
            st = result["ticker_stats"][t]
            print(f"    {t}: {st['num_trades']} trades | WR {st['win_rate']:.0f}%")

    # Equity curve
    print("\n  📈 Building equity curve...")
    chart_adn, portfolio_dd = build_monthly_equity(result["equity_daily"])

    # VNINDEX
    print("  📉 Fetching VNINDEX...")
    vnindex_map = get_vnindex_monthly(START_DATE, END_DATE)

    # Merge
    chart_data = []
    first_vni = None
    for point in chart_adn:
        d = point["date"]
        vni_raw = vnindex_map.get(d)
        entry = {"date": d, "adn": point["adn"]}
        if vni_raw is not None:
            if first_vni is None:
                first_vni = vni_raw
            entry["vnindex"] = round(vni_raw / first_vni * 100, 1)
        chart_data.append(entry)

    # CB annotations
    cb_on = None
    cb_off = None
    for i in range(1, len(chart_data)):
        vni = chart_data[i].get("vnindex")
        vni_prev = chart_data[i - 1].get("vnindex")
        if vni and vni_prev:
            if not cb_on and vni < vni_prev * 0.95 and vni_prev > 120:
                cb_on = chart_data[i]["date"]
            if cb_on and not cb_off and vni > vni_prev * 1.05:
                cb_off = chart_data[i]["date"]

    # Snapshot
    snapshot = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "period": f"{START_DATE[:4]}–{END_DATE[:4]}",
        "start_year": int(START_DATE[:4]),
        "end_year": int(END_DATE[:4]),
        "tickers": TICKERS,
        "kpi": {
            "total_return": round(result["total_return"], 1),
            "win_rate": round(result["win_rate"], 1),
            "max_drawdown": round(portfolio_dd, 1),
            "total_trades": result["num_trades"],
            "multiplier": result["multiplier"],
        },
        "chart_data": chart_data,
        "annotations": {
            "cb_on": cb_on,
            "cb_off": cb_off,
            "bear_label": "Bear market — VN-INDEX giảm sâu, ADN CAPITAL flat (Circuit Breaker → 100% tiền mặt)",
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ Snapshot đã ghi: {OUTPUT_PATH}")
    print(f"   Vốn cuối: {result['balance']:,.0f} VNĐ")
    print(f"   Lợi nhuận: +{result['total_return']:.1f}%")
    print(f"   💥 NHÂN VỐN: x{result['multiplier']:.1f} ({INITIAL_CAPITAL/1e6:.0f}M → {result['balance']/1e6:.0f}M)")
    print(f"   Win Rate: {result['win_rate']:.0f}%")
    print(f"   Max DD: -{portfolio_dd:.1f}% (portfolio)")
    print(f"   Trades: {result['num_trades']}")
    print(f"   Chart: {len(chart_data)} months")
    print(f"   CB ON: {cb_on or 'N/A'} | CB OFF: {cb_off or 'N/A'}")


if __name__ == "__main__":
    main()
