/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { useAppDispatch, useGetState, usePostFinancialEvent } from './AppStore';
import { useCurrentUser } from './session';
import * as wf from './workflows';
import { WorkflowEnv } from './workflows';

/** Workflow functions exposed to the UI (each takes the environment as first argument). */
const WORKFLOW_ACTIONS = [
  'createClientStatement',
  'advanceClientStatement',
  'returnClientStatement',
  'recordReceipt',
  'createSubcontractorStatement',
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
  'createPaymentRequest',
  'approvePaymentRequest',
  'rejectPaymentRequest',
  'executePayment',
  'approvePayrollPeriod',
  'createManualJournalEntry',
  'approveJournalEntry',
  'rejectJournalEntry',
  'reverseJournalEntry',
  'closeFiscalYear',
  'updateFinanceSettings',
  'updatePettyCashSettings',
  'reconcilePettyCash',
  'addDocument',
  'linkDocument',
  'receiveGoodsFromPO',
  'requestStoreIssue',
  'confirmStoreIssue',
  'releaseStoreIssue',
  'returnFromProject',
  'returnToSupplier',
  'createTransfer',
  'advanceTransfer',
  'applyStocktake',
] as const;

type ActionName = (typeof WORKFLOW_ACTIONS)[number];
type Bound<F> = F extends (env: WorkflowEnv, ...args: infer A) => infer R ? (...args: A) => R : never;
export type WorkflowApi = { [K in ActionName]: Bound<(typeof wf)[K]> };

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
    for (const name of WORKFLOW_ACTIONS) {
      const fn = wf[name] as (env: WorkflowEnv, ...a: unknown[]) => unknown;
      api[name] = (...args: unknown[]) => fn(env, ...args);
    }
    return api as WorkflowApi;
  }, [dispatch, getState, post, user]);
}
