#!/usr/bin/env python3
"""《糯酿》经济期望值手算（docs/04 §12）。

逐日期望值，不掷骰。用来在蒙特卡洛模拟器 sim_economy.py 落地前，
检查「客流 × 每位客人带来的钱」能否支撑升级节奏。
改了 04 的任何数字后，先改本文件顶部常量，再运行：

    python3 tools/econ_handcalc.py

常量必须与 docs/04_数值平衡初版.md 一致；本脚本不读 content/ 表（表尚未落地）。
"""

from __future__ import annotations

import math

# ---- 04 §1、§10 ----
START_MONEY = 160
START_RENOWN = 15
DAILY_COST = 8
WAGE_FROM_LEVEL3 = 10
UPGRADE_COST = {2: 280, 3: 540, 4: 860}
UPGRADE_RENOWN = {2: 25, 3: 45, 4: 65}
TRAFFIC_BASE = {1: 3, 2: 4, 3: 4, 4: 5}
A_REF, TRAFFIC_FLOOR, TRAFFIC_SPAN, MOOD_SPAN = 36, 0.65, 0.35, 0.20
FAIR_MUL, RAIN_P = 1.5, 0.16
FAIR_DAYS = {6, 13, 20, 27}
WEIGHT = {"neighbor": 0.55, "tea": 0.30, "merchant": 0.15}
FAIR_EXTRA = {"tourist": 0.35}

# ---- 04 §6、§7、§9：白糯优良、人手蒸、无瑕疵 ----
BASE = {"sweet": 14, "rice": 36, "clear": 44, "osmanthus": 52}
QUALITY = {"sweet": 64, "rice": 68, "clear": 70, "osmanthus": 68}
TIER = {"让利": 0.85, "平价": 1.00, "讲究": 1.25}
UNIT_COST = {"sweet": 3, "rice": 8, "clear": 8, "osmanthus": 9}  # 米、曲、桂花摊到每件

# ---- 04 §10.5 批购 ----
BULK_ACCEPT_DAYS = (3, 9, 15, 21)
BULK = {1: ("rice", 2, 20), 2: ("rice", 2, 20), 3: ("clear", 3, 30), 4: ("osmanthus", 3, 40)}
BULK_DUE = 5

UPGRADE_RESERVE = 30  # 升级后至少留下的文
RENOWN_PER_SALE = 1.3  # 成色 ≥70 记 +2，<70 记 +1，按混合估


def rnd(x: float) -> int:
    """四舍五入，0.5 进一（13 §开头）。"""
    return math.floor(x + 0.5)


def price(path: str, tier: str = "平价", mood: float = 1.0) -> int:
    q = QUALITY[path]
    return max(1, rnd(BASE[path] * (0.70 + 0.60 * q / 100) * TIER[tier] * mood))


def bulk_price(path: str) -> int:
    q = QUALITY[path]
    return rnd(BASE[path] * (0.70 + 0.60 * q / 100) * 0.90)


def traffic(level: int, fair: bool, rain_p: float, a: float) -> float:
    a_norm = min(a / A_REF, 1.0)
    t = rnd(TRAFFIC_BASE[level] * (TRAFFIC_FLOOR + TRAFFIC_SPAN * a_norm))
    if fair:
        t = rnd(t * FAIR_MUL)
    return (1 - rain_p) * t + rain_p * max(t - 1, 1)


def run(conversion: float = 0.85, atmosphere: float = 18, verbose: bool = False):
    mood = 1 + MOOD_SPAN * min(atmosphere / A_REF, 1.0)  # 封签同风格
    p = {
        "sweet": price("sweet", "平价", mood),
        "rice": price("rice", "平价", mood),
        "clear": price("clear", "讲究", mood),        # 茶客接受讲究
        "osmanthus": price("osmanthus", "讲究", mood),  # 游客接受讲究
    }
    money, renown, level = float(START_MONEY), float(START_RENOWN), 1
    reached = {1: 1}
    pending = None
    bulk_due: dict[int, tuple[int, int]] = {}
    for day in range(1, 29):
        if pending:
            level, pending = pending, None
            reached[level] = day
        fair = day in FAIR_DAYS
        rain_p = 0.0 if day <= 3 else RAIN_P
        n = traffic(level, fair, rain_p, atmosphere)
        weights = dict(WEIGHT)
        if fair:
            weights.update(FAIR_EXTRA)
        total = sum(weights.values())
        weights = {k: v / total for k, v in weights.items()}

        rice_ok = day >= 2  # 开局批 A 第 2 日出窖
        clear_ok = level >= 2 and day >= reached[2] + 2
        osm_ok = level >= 3 and day >= reached[3] + 2
        margin, sold = 0.0, 0.0

        def take(w: float, path: str) -> None:
            nonlocal margin, sold
            margin += w * (p[path] - UNIT_COST[path])
            sold += w

        take(weights["neighbor"], "sweet")
        if level < 2:
            if rice_ok:
                take(weights["tea"], "rice")
        elif clear_ok:
            take(weights["tea"], "clear")
        if rice_ok:
            take(weights["merchant"], "rice")
        if "tourist" in weights:
            take(weights["tourist"], "osmanthus" if osm_ok else "sweet")

        money += n * margin * conversion
        renown = min(100.0, renown + n * sold * conversion * RENOWN_PER_SALE)

        if day in BULK_ACCEPT_DAYS:
            path, count, deposit = BULK[level]
            money += deposit
            bulk_due[day + BULK_DUE] = (level, deposit)
        if day in bulk_due:
            lv, deposit = bulk_due.pop(day)
            path, count, _ = BULK[lv]
            money += count * bulk_price(path) - deposit - count * UNIT_COST[path]
            renown = min(100.0, renown + 3)

        money -= DAILY_COST + (WAGE_FROM_LEVEL3 if level >= 3 else 0)
        if verbose:
            print(f"第{day:>2}日 {level}级 客流{n:4.2f} 文{money:7.0f} 声望{renown:5.1f}")
        nxt = level + 1
        if nxt <= 4 and not pending and money >= UPGRADE_COST[nxt] + UPGRADE_RESERVE \
                and renown >= UPGRADE_RENOWN[nxt]:
            money -= UPGRADE_COST[nxt]
            pending = nxt
            if day == 28:
                reached[nxt] = "28日收工付款"
    return {k: v for k, v in reached.items() if k > 1}, round(money)


def main() -> None:
    print("单价（平价/讲究，moodK 1.10）：",
          {k: price(k, "讲究" if k in ("clear", "osmanthus") else "平价", 1.10)
           for k in BASE})
    print("批购单价：", {k: bulk_price(k) for k in BASE})
    print()
    print(f"{'布置A':>5} {'成交率':>6}  到级日（2/3/4）  第28日余钱")
    for a in (18, 36):
        for c in (0.70, 0.85, 0.95):
            reached, money = run(c, a)
            print(f"{a:>5} {c:>6.2f}  {reached}  {money}")


if __name__ == "__main__":
    main()
