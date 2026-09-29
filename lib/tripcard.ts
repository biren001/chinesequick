"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 行程卡（Address Card / Emergency Card）共用的一份本地数据。
 *
 * 设计决定：
 * - 两张卡共用一个 localStorage key：酒店地址在两张卡上都要出现
 *   （地址卡给司机看，紧急卡给医生/警察看），填一次两边都有。
 * - key 与 lib/progress.ts 的学习进度分开 —— 进度可以被清掉重学，
 *   行程卡清掉就是灾难（人在中国，酒店地址没了）。
 */

const STORAGE_KEY = "rlc-tripcard-v1";

export interface TripCardState {
  version: 1;
  /** 酒店中文名（地址卡主行） */
  hotelName: string;
  /** 酒店中文地址 */
  hotelAddress: string;
  /** 酒店前台电话 */
  hotelPhone: string;
  /** 备用地标 / 备选目的地（司机找不到酒店时退到这里） */
  backupDest: string;
  /** 姓名（护照拼写） */
  guestName: string;
  /** 国籍 */
  nationality: string;
  /** 血型 */
  bloodType: string;
  /** 过敏（没有就留空） */
  allergies: string;
  /** 长期用药 */
  medications: string;
  /** 紧急联系人（姓名 + 电话） */
  emergencyContact: string;
}

export const EMPTY_TRIP_CARD: TripCardState = {
  version: 1,
  hotelName: "",
  hotelAddress: "",
  hotelPhone: "",
  backupDest: "",
  guestName: "",
  nationality: "",
  bloodType: "",
  allergies: "",
  medications: "",
  emergencyContact: "",
};

/** 单字段上限：卡片是要「一眼读完」的，塞进去一篇文章反而没法看。 */
const MAX_LEN = 120;

const FIELDS = [
  "hotelName",
  "hotelAddress",
  "hotelPhone",
  "backupDest",
  "guestName",
  "nationality",
  "bloodType",
  "allergies",
  "medications",
  "emergencyContact",
] as const;

/**
 * 和 lib/progress.ts 同一条防线：localStorage 里的数据可能来自旧版本、
 * 别的项目占了同名 key、或被扩展改坏。任何形状不对都在「读」这一步挡掉，
 * 绝不让坏数据活到 render（那是整页白屏，而且只有部分用户碰得到）。
 */
function sanitize(value: unknown): TripCardState {
  if (!value || typeof value !== "object") return EMPTY_TRIP_CARD;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return EMPTY_TRIP_CARD;
  const out = { ...EMPTY_TRIP_CARD };
  for (const f of FIELDS) {
    const v = raw[f];
    if (typeof v === "string") out[f] = v.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  }
  return out;
}

function loadTripCard(): TripCardState {
  if (typeof window === "undefined") return EMPTY_TRIP_CARD;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_TRIP_CARD;
    return sanitize(JSON.parse(raw));
  } catch {
    return EMPTY_TRIP_CARD;
  }
}

function saveTripCard(state: TripCardState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式下写入失败：卡片当次还能用，不打断用户
  }
}

/**
 * 两张卡共用的读写 hook。SSR 期间是空卡，挂载后读本地 ——
 * 和清单页的进度条同一个模式，React 对这种「挂载后补内容」是安全的。
 */
export function useTripCard(): [
  TripCardState,
  (patch: Partial<TripCardState>) => void,
  boolean,
] {
  const [state, setState] = useState<TripCardState>(EMPTY_TRIP_CARD);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(loadTripCard());
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<TripCardState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveTripCard(next);
      return next;
    });
  }, []);

  return [state, update, ready];
}
