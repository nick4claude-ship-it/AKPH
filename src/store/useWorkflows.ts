/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { appReducer, SERVER_REQUIRED_MESSAGE, useAppDispatch, useDataSource, useGetState, usePostFinancialEvent } from './AppStore';
import { useCurrentUser } from './session';
import * as wf from './workflows';
import { WorkflowEnv, WorkflowResult } from './workflows';
import { applyPosting, preparePosting } from './postingEngine';
import { emitToast } from './toast';
import type { AppState } from './types';

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
  'reconcileBankItem',
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

/**
 * Runs a workflow against a throw-away copy of the state. With a server, this only validates the user's
 * input with the reference rules before the command is sent; nothing computed here is ever sent.
 */
function dryRun(state: AppState, user: WorkflowEnv['user'], fn: (env: WorkflowEnv, ...a: unknown[]) => unknown, args: unknown[]): WorkflowResult {
  let scratch = state;
  const env: WorkflowEnv = {
    getState: () => scratch,
    set: (key, updater) => {
      scratch = appReducer(scratch, { type: 'SET_SLICE', key, updater });
    },
    post: (input, options) => {
      const result = preparePosting(scratch, input, { ...options, actor: user });
      if (result.ok && !result.duplicate && result.event && result.entry) scratch = applyPosting(scratch, result.event, result.entry);
      return result;
    },
    user,
  };
  return fn(env, ...args) as WorkflowResult;
}

/** Workflow services bound to the store and the signed-in user. */
export function useWorkflows(): WorkflowApi {
  const dispatch = useAppDispatch();
  const getState = useGetState();
  const post = usePostFinancialEvent();
  const user = useCurrentUser();
  const dataSource = useDataSource();

  return useMemo(() => {
    const env: WorkflowEnv = {
      getState,
      set: (key, updater) => dispatch({ type: 'SET_SLICE', key, updater }),
      post: (input, options) => post(input, { ...options, actor: user }),
      user,
    };
    const commands = dataSource?.commands;
    const api: Record<string, unknown> = {};
    for (const name of WORKFLOW_ACTIONS) {
      const fn = wf[name] as (env: WorkflowEnv, ...a: unknown[]) => unknown;
      if (!commands) {
        api[name] = (...args: unknown[]) => fn(env, ...args);
        continue;
      }
      // Server-owned data: validate locally, then let the server execute the command and return records.
      api[name] = (...args: unknown[]): WorkflowResult => {
        if (!commands.supports(name)) return { ok: false, message: SERVER_REQUIRED_MESSAGE };
        const state = getState();
        const check = dryRun(state, user, fn, args);
        if (!check.ok) return check;
        commands
          .run(name, args, state)
          .then((result) => {
            dispatch({ type: 'MERGE_SERVER_RECORDS', records: result.records });
            emitToast(result.message);
          })
          .catch((err: unknown) => emitToast((err as { farsiMessage?: string })?.farsiMessage || 'سرور درخواست را نپذیرفت.'));
        return { ok: true, message: 'درخواست به سرور ارسال شد…' };
      };
    }
    return api as WorkflowApi;
  }, [dispatch, getState, post, user, dataSource]);
}
