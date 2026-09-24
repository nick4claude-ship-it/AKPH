/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { fromDisplayAmount, moneyUnitLabel, toDisplayAmount, tryParseIntegerAmount, maxMoneyInput } from '../../utils/money';

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
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">{moneyUnitLabel()}</span>
    </div>
  );
};
