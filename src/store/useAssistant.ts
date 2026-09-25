/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { useAppState } from './AppStore';
import { answerManagementQuery } from './assistant';
import { generateUUID } from '../utils/ids';
import { toPersianTime } from '../utils/date';

export interface AssistantMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  dataPoints?: { label: string; value: string }[];
  time: string;
}

/**
 * The management assistant of the demo: answers are computed with fixed rules from the store
 * (ledger, contracts, statements, petty cash, procurement, inventory); no language model is called.
 */
export function useAssistant() {
  const state = useAppState();
  const userMessage = useCallback((text: string): AssistantMessage => ({ id: generateUUID(), sender: 'user', text, time: toPersianTime(new Date()) }), []);
  const reply = useCallback(
    (question: string): AssistantMessage => {
      const answer = answerManagementQuery(state, question);
      return { id: generateUUID(), sender: 'ai', text: answer.text, dataPoints: answer.dataPoints, time: toPersianTime(new Date()) };
    },
    [state]
  );
  return { userMessage, reply };
}
