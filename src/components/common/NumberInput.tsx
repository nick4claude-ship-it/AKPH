/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { fromDisplayAmount, moneyUnitLabel, parseIntegerAmount, toDisplayAmount } from '../../utils/money';

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
export const IntegerInput: React.FC<BaseProps> = ({ value, onValueChange, blankZero, onBlur, ...rest }) => {
  const [text, setText] = useState(() => show(value, blankZero));

  // Follow external changes (e.g. a reset) without fighting the user's typing.
  useEffect(() => {
    if (parseIntegerAmount(text) !== value) setText(show(value, blankZero));
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onValueChange(parseIntegerAmount(e.target.value));
      }}
      onBlur={(e) => {
        setText(show(parseIntegerAmount(text), blankZero));
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
