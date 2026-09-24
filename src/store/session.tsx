/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext } from 'react';
import { UserProfile } from '../types';
import { currentUser as defaultUser } from '../data/mockData';

/** The signed-in user; workflows use it for role checks and audit trails. */
const CurrentUserContext = createContext<UserProfile>(defaultUser);

export const CurrentUserProvider: React.FC<{ user: UserProfile; children: React.ReactNode }> = ({ user, children }) => (
  <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>
);

export function useCurrentUser(): UserProfile {
  return useContext(CurrentUserContext);
}

/** A step may be performed by its designated role; the CEO may act on any step. */
export function canAct(user: UserProfile, role: string): boolean {
  return user.role === role || user.role === 'مدیرعامل';
}
