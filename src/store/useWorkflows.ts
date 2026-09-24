/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { useAppDispatch, useGetState, usePostFinancialEvent } from './AppStore';
import { useCurrentUser } from './session';
import * as wf from './workflows';
import { WorkflowEnv } from './workflows';

type Bound<F> = F extends (env: WorkflowEnv, ...args: infer A) => infer R ? (...args: A) => R : never;
type WorkflowApi = { [K in keyof typeof wf as (typeof wf)[K] extends (env: WorkflowEnv, ...a: any[]) => any ? K : never]: Bound<(typeof wf)[K]> };

/** Workflow services bound to the store and the signed-in user. */
export function useWorkflows(): WorkflowApi {
  const dispatch = useAppDispatch();
  const getState = useGetState();
  const post = usePostFinancialEvent();
  const user = useCurrentUser();

  return useMemo(() => {
    const env: WorkflowEnv = {
      getState,
      set: (key, updater) => dispatch({ type: 'SET_SLICE', key, updater }),
      post,
      user,
    };
    const api: Record<string, unknown> = {};
    for (const [name, fn] of Object.entries(wf)) {
      if (typeof fn === 'function' && fn.length >= 1 && WORKFLOW_ACTIONS.has(name)) {
        api[name] = (...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(env, ...args);
      }
    }
    return api as WorkflowApi;
  }, [dispatch, getState, post, user]);
}

/** Exported workflow functions that take the environment as first argument. */
const WORKFLOW_ACTIONS = new Set([
  'advanceClientStatement',
  'returnClientStatement',
  'recordReceipt',
  'advanceSubcontractorStatement',
  'returnSubcontractorStatement',
  'submitPettyCashExpense',
  'approvePettyCashExpense',
  'rejectPettyCashExpense',
  'requestPettyCashReplenishment',
  'approveVendorInvoice',
  'rejectVendorInvoice',
  'approveRequisition',
  'cancelRequisition',
  'approvePaymentRequest',
  'rejectPaymentRequest',
  'executePayment',
  'approvePayrollPeriod',
  'approveJournalEntry',
  'rejectJournalEntry',
  'addDocument',
  'linkDocument',
  'receiveGoodsFromPO',
  'requestStoreIssue',
  'confirmStoreIssue',
  'releaseStoreIssue',
  'returnFromProject',
  'returnToSupplier',
  'completeTransfer',
  'applyStocktake',
]);
