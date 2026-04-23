export const LOAN_WRITE_OFF_MARKER = '[EMERALD_WRITTEN_OFF]';

export interface LoanWriteOffMeta {
  reason: string;
  amount: number;
  writtenOffAt: string;
}

export const extractLoanWriteOffMeta = (notes?: string | null): LoanWriteOffMeta | null => {
  if (!notes || !notes.includes(LOAN_WRITE_OFF_MARKER)) {
    return null;
  }

  const markerIndex = notes.indexOf(LOAN_WRITE_OFF_MARKER);
  const serialized = notes.slice(markerIndex + LOAN_WRITE_OFF_MARKER.length).trim();

  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      reason: String(parsed.reason || 'Baixa manual'),
      amount: Number(parsed.amount || 0),
      writtenOffAt: String(parsed.writtenOffAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
};

export const isLoanWrittenOff = (notes?: string | null) => extractLoanWriteOffMeta(notes) !== null;

export const appendLoanWriteOffMeta = (notes: string | null | undefined, payload: LoanWriteOffMeta) => {
  const cleanNotes = (notes || '')
    .split(LOAN_WRITE_OFF_MARKER)[0]
    .trim();

  const serialized = `${LOAN_WRITE_OFF_MARKER} ${JSON.stringify(payload)}`;
  return cleanNotes ? `${cleanNotes}\n\n${serialized}` : serialized;
};
