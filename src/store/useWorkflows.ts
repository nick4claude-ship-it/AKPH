/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { appReducer, SERVER_REQUIRED_MESSAGE, useAppDispatch, useDataSource, useGetState, usePostFinancialEvent } from './AppStore';
import { useCurrentUser } from './session';
import * as workflows from './workflows';
import * as recordWorkflows from './recordWorkflows';
import { WorkflowEnv, WorkflowResult } from './workflowKit';
import { applyPosting, preparePosting } from './postingEngine';
import { emitToast } from './toast';
import { commandKeys } from './commandKeys';
import { ApiError } from '../api/client';
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
  // Master records (recordWorkflows.ts)
  'createClientContract',
  'createContractAmendment',
  'submitClientStatementForm',
  'decideClientStatement',
  'createSubcontractorContract',
  'submitSubcontractorStatementForm',
  'decideSubcontractorStatement',
  'createRequisition',
  'createRfqFromRequisition',
  'selectWinningBid',
  'createPurchaseOrderFromRfq',
  'createPurchaseOrder',
  'updatePurchaseOrderStatus',
  'createSupplier',
  'createMaterial',
  'submitStoreIssueForm',
  'submitTransferForm',
  'applyStocktakeById',
  'createPettyCashFund',
  'submitPettyExpenseForm',
  'updatePettyCashCategories',
  'submitManualJournalEntryForm',
  'approveJournalEntryLogged',
  'rejectJournalEntryLogged',
  'reverseJournalEntryLogged',
  'reconcileBankItemLogged',
  'closeFiscalYearLogged',
  'payRequestForm',
  'createManualPaymentRequest',
  'uploadDocument',
  // Base records (server: akph/v1)
  'createProject',
  'updateProject',
  'createCostCenter',
  'createCounterparty',
  'createAccount',
] as const;

const wf = { ...workflows, ...recordWorkflows };

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
        // One Idempotency-Key per form submission: the same submission sent again reuses it.
        const { key, inFlight } = commandKeys.acquire(name, args);
        if (inFlight) return { ok: true, message: 'همین درخواست در حال ارسال است…' };
        commands
          .run(name, args, state, key)
          .then((result) => {
            commandKeys.settle(key, 'ok');
            dispatch({ type: 'MERGE_SERVER_RECORDS', records: result.records });
            emitToast(result.message);
          })
          .catch((err: unknown) => {
            commandKeys.settle(key, err instanceof ApiError && err.outcomeUnknown ? 'unknown' : 'rejected');
            emitToast((err as { farsiMessage?: string })?.farsiMessage || 'سرور درخواست را نپذیرفت.');
          });
        return { ok: true, message: 'درخواست به سرور ارسال شد…' };
      };
    }
    return api as WorkflowApi;
  }, [dispatch, getState, post, user, dataSource]);
}
