/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MaterialItem } from '../types';

/** Moving weighted-average cost after receiving `qty` units at `unitPrice`. */
export function receiveIntoStock(m: MaterialItem, qty: number, unitPrice: number): MaterialItem {
  const currentStock = m.currentStock + qty;
  const average = currentStock > 0 ? (m.currentStock * m.averageUnitPrice + qty * unitPrice) / currentStock : m.averageUnitPrice;
  return {
    ...m,
    currentStock,
    averageUnitPrice: Math.round(average),
    totalStockValue: Math.round(currentStock * average),
  };
}

/** Issues `qty` units at the current weighted-average cost; returns the updated item and the issue cost. */
export function issueFromStock(m: MaterialItem, qty: number): { material: MaterialItem; cost: number } {
  const cost = Math.round(qty * m.averageUnitPrice);
  const currentStock = Math.max(0, m.currentStock - qty);
  return {
    material: { ...m, currentStock, totalStockValue: Math.round(currentStock * m.averageUnitPrice) },
    cost,
  };
}
