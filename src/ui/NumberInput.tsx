/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { fromDisplayAmount, moneyUnitLabel, toDisplayAmount, tryParseIntegerAmount, maxMoneyInput } from '../utils/money';

type BaseProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> & {
  value: number;
  onValueChange: (value: number) => void;
  /** Show an empty field instead of «۰». */
  blankZero?: boolean;
};

const show = (n: number, blankZero?: boolean) => (blankZero && n === 0 ? '' : n.toLocaleString('fa-IR'));

/**
 * Positive-integer field. Accepts Persian, Arabic and Latin digits and separators;
 * every keystroke is read with parseIntegerAmount, so the value is always a safe integer ≥ 0.
 */
export const IntegerInput: React.FC<BaseProps & { max?: number }> = ({ value, onValueChange, blankZero, onBlur, max, className, ...rest }) => {
  const [text, setText] = useState(() => show(value, blankZero));
  const [error, setError] = useState<string | null>(null);
  const read = (t: string) => {
    const r = tryParseIntegerAmount(t);
    if (r.ok && max !== undefined && r.value > max) return { ok: false as const, error: 'مبلغ واردشده بیش از حد بزرگ است.' };
    return r;
  };

  // Follow external changes (e.g. a reset) without fighting the user's typing.
  useEffect(() => {
    const r = read(text);
    if (!r.ok || r.value !== value) {
      setText(show(value, blankZero));
      setError(null);
    }
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={text}
      aria-invalid={error ? true : undefined}
      title={error ?? rest.title}
      className={error ? `${className || ''} ring-1 ring-rose-400` : className}
      onChange={(e) => {
        setText(e.target.value);
        const r = read(e.target.value);
        // An overflowing amount is reported and never replaced by 0; the last valid value stays.
        if (!r.ok) return setError(r.error);
        setError(null);
        onValueChange(r.value);
      }}
      onBlur={(e) => {
        const r = read(text);
        setText(show(r.ok ? r.value : value, blankZero));
        setError(null);
        onBlur?.(e);
      }}
    />
  );
};

/**
 * Money field. The user types in the display currency (تومان/ریال, chosen once by the data source);
 * the value going in and out is always integer Rials.
 */
export const MoneyInput: React.FC<BaseProps & { showUnit?: boolean }> = ({ value, onValueChange, showUnit = false, className, ...rest }) => {
  const input = (
    <IntegerInput
      {...rest}
      className={showUnit ? `${className || ''} pl-12` : className}
      value={toDisplayAmount(value)}
      max={maxMoneyInput()}
      onValueChange={(n) => onValueChange(fromDisplayAmount(n))}
    />
  );
  if (!showUnit) return input;
  return (
    <div className="relative">
      {input}
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">{moneyUnitLabel()}</span>
    </div>
  );
};

/** Whole-number percentage (0–100). Anything above 100 is read as 100. */
export const PercentInput: React.FC<Omit<BaseProps, 'max'>> = ({ onValueChange, ...rest }) => (
  <IntegerInput {...rest} onValueChange={(v) => onValueChange(Math.min(100, v))} />
);

const LATIN_DIGITS: Record<string, string> = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const showQty = (n: number, blankZero?: boolean) => (blankZero && n === 0 ? '' : n.toLocaleString('fa-IR', { maximumFractionDigits: 3 }));

/** Reads a quantity with up to three decimals (Persian/Arabic/Latin digits, «٫» or «.»). */
function readQuantity(t: string, signed: boolean): { ok: true; value: number } | { ok: false; error: string } {
  const s = t.replace(/[۰-۹٠-٩]/g, (d) => LATIN_DIGITS[d]).replace(/[٬,\s]/g, '').replace(/[٫/]/g, '.').replace(/[−–]/g, '-');
  if (s === '' || s === '-') return { ok: true, value: 0 };
  if (!(signed ? /^-?\d{1,12}(\.\d{0,3})?$/ : /^\d{1,12}(\.\d{0,3})?$/).test(s)) return { ok: false, error: 'مقدار باید عدد با حداکثر سه رقم اعشار باشد.' };
  return { ok: true, value: Number(s) };
}

/**
 * Quantity field (DECIMAL(18,3) on the server): up to three decimals; `signed` allows a negative change
 * (amendments that reduce a line).
 */
export const QuantityInput: React.FC<BaseProps & { signed?: boolean }> = ({ value, onValueChange, blankZero, onBlur, signed = false, className, ...rest }) => {
  const [text, setText] = useState(() => showQty(value, blankZero));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = readQuantity(text, signed);
    if (!r.ok || r.value !== value) {
      setText(showQty(value, blankZero));
      setError(null);
    }
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      dir="ltr"
      value={text}
      aria-invalid={error ? true : undefined}
      title={error ?? rest.title}
      className={error ? `${className || ''} ring-1 ring-rose-400` : className}
      onChange={(e) => {
        setText(e.target.value);
        const r = readQuantity(e.target.value, signed);
        if (!r.ok) return setError(r.error);
        setError(null);
        onValueChange(r.value);
      }}
      onBlur={(e) => {
        const r = readQuantity(text, signed);
        setText(showQty(r.ok ? r.value : value, blankZero));
        setError(null);
        onBlur?.(e);
      }}
    />
  );
};
