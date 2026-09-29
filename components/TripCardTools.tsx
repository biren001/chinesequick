"use client";

import { useId } from "react";
import AudioButton from "@/components/AudioButton";
import { useTripCard, type TripCardState } from "@/lib/tripcard";

/**
 * Address Card / Emergency Card 的填写与展示。
 * 两张卡共用一份数据（lib/tripcard.ts）—— 酒店信息填一次，两边都有。
 */

const inputCls =
  "mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted/60 focus:border-accent";

function Field({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={120}
        autoComplete="off"
        className={inputCls}
      />
    </div>
  );
}

function CardRow({ zh, value }: { zh: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
      <span className="w-14 shrink-0 text-sm leading-snug text-muted">{zh}</span>
      <span className="min-w-0 flex-1 break-words text-xl leading-snug font-medium text-ink">
        {value}
      </span>
    </div>
  );
}

/** 卡片外框：大字、高对比、打印时只留这一块。 */
function CardFrame({
  title,
  children,
  filled,
}: {
  title: string;
  children: React.ReactNode;
  filled: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 border-ink/80 bg-white p-5 text-ink print:border-ink">
      <p className="text-xs font-semibold tracking-wide text-muted">{title}</p>
      {filled ? (
        <div className="mt-2">{children}</div>
      ) : (
        <p className="mt-2 text-base leading-relaxed text-muted">
          Fill in the fields above — what you type shows up here in big print,
          ready to show or screenshot.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Address Card                                                        */
/* ------------------------------------------------------------------ */

export function AddressCardTool() {
  const [card, update] = useTripCard();
  const filled = Boolean(card.hotelName || card.hotelAddress || card.hotelPhone);

  return (
    <div>
      <div className="space-y-4 rounded-2xl border border-line bg-card p-5 print:hidden">
        <Field
          label="Hotel name (in Chinese)"
          hint="Copy it from your booking page — hotels show the Chinese name next to the English one."
          placeholder="北京王府井希尔顿酒店"
          value={card.hotelName}
          onChange={(v) => update({ hotelName: v })}
        />
        <Field
          label="Hotel address (in Chinese)"
          hint="From the booking page or the hotel's own site. Chinese addresses run city → district → street → building."
          placeholder="北京市东城区王府井东街8号"
          value={card.hotelAddress}
          onChange={(v) => update({ hotelAddress: v })}
        />
        <Field
          label="Hotel phone (in Chinese)"
          hint="The front desk number. A driver who can't find the address will call it."
          placeholder="010-8500-8000"
          value={card.hotelPhone}
          onChange={(v) => update({ hotelPhone: v })}
        />
        <Field
          label="Backup destination (optional)"
          hint="A landmark near your hotel, or the airport you fly into — somewhere any driver knows."
          placeholder="王府井地铁站"
          value={card.backupDest}
          onChange={(v) => update({ backupDest: v })}
        />
      </div>

      <div className="mt-6">
        <CardFrame title="我的酒店 · MY HOTEL" filled={filled}>
          <CardRow zh="酒店" value={card.hotelName} />
          <CardRow zh="地址" value={card.hotelAddress} />
          <CardRow zh="电话" value={card.hotelPhone} />
          <CardRow zh="备用" value={card.backupDest} />
        </CardFrame>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!filled}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-40"
        >
          Print this card
        </button>
        <p className="text-xs text-muted">
          Saved only on this device · works offline
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Emergency Card                                                      */
/* ------------------------------------------------------------------ */

export function EmergencyCardTool() {
  const [card, update] = useTripCard();
  const filled = Boolean(
    card.guestName ||
      card.nationality ||
      card.bloodType ||
      card.allergies ||
      card.medications ||
      card.emergencyContact ||
      card.hotelName
  );

  return (
    <div>
      <div className="space-y-4 rounded-2xl border border-line bg-card p-5 print:hidden">
        <Field
          label="Your name"
          hint="Exactly as it is spelled in your passport."
          placeholder="SMITH JAMES"
          value={card.guestName}
          onChange={(v) => update({ guestName: v })}
        />
        <Field
          label="Nationality"
          placeholder="British"
          value={card.nationality}
          onChange={(v) => update({ nationality: v })}
        />
        <Field
          label="Blood type (if you know it)"
          placeholder="O+"
          value={card.bloodType}
          onChange={(v) => update({ bloodType: v })}
        />
        <Field
          label="Allergies"
          hint="Leave empty if none. Doctors here read Chinese — but your Chinese characters will be shown to a pharmacist faster than they can find a translator."
          placeholder="penicillin"
          value={card.allergies}
          onChange={(v) => update({ allergies: v })}
        />
        <Field
          label="Medications you take"
          placeholder="none"
          value={card.medications}
          onChange={(v) => update({ medications: v })}
        />
        <Field
          label="Emergency contact (name + phone)"
          hint="Someone at home, with the international dialling code."
          placeholder="+44 7700 900123 (Sarah)"
          value={card.emergencyContact}
          onChange={(v) => update({ emergencyContact: v })}
        />
      </div>

      <div className="mt-6">
        <CardFrame title="紧急信息 · IN AN EMERGENCY" filled={filled}>
          <CardRow zh="姓名" value={card.guestName} />
          <CardRow zh="国籍" value={card.nationality} />
          <CardRow zh="血型" value={card.bloodType} />
          <CardRow zh="过敏" value={card.allergies} />
          <CardRow zh="用药" value={card.medications} />
          <CardRow zh="联系人" value={card.emergencyContact} />
          <CardRow zh="酒店" value={card.hotelName} />
          <CardRow zh="地址" value={card.hotelAddress} />
        </CardFrame>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!filled}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-40"
        >
          Print this card
        </button>
        <p className="text-xs text-muted">
          Saved only on this device · works offline
        </p>
      </div>
    </div>
  );
}

export type { TripCardState };
