/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppDocument } from '../../types';
import { AppState } from '../../store/types';

/** Contract-side view of a document-center record (the document itself lives only in the center). */
export interface ContractFile {
  id: string;
  contractId?: string;
  statementId?: string;
  fileName: string;
  fileType: string;
  version: string;
  uploadDate: string;
  uploaderName: string;
  fileSize: string;
  downloadUrl?: string;
}

export function toContractFile(d: AppDocument): ContractFile {
  return {
    id: d.id,
    contractId: d.links.find((l) => l.entityType === 'contract' || l.entityType === 'subcontract')?.entityId,
    statementId: d.links.find((l) => l.entityType === 'client_statement' || l.entityType === 'subcontractor_statement')?.entityId,
    fileName: d.fileName,
    fileType: d.type,
    version: d.version,
    uploadDate: d.date,
    uploaderName: d.registeredBy,
    fileSize: d.fileSize,
    downloadUrl: d.url,
  };
}

/** All documents linked to any client contract or client statement. */
export function selectContractFiles(state: AppState): ContractFile[] {
  return state.documents
    .filter((d) => d.links.some((l) => l.entityType === 'contract' || l.entityType === 'client_statement'))
    .map(toContractFile);
}
