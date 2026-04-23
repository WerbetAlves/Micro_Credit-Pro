import { parseAppDate } from './date';

export type InstallmentDisplayStatus = 'upcoming' | 'paid' | 'late' | 'missed';

export const getTodayLocal = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const getInstallmentDisplayStatus = (installment: {
  due_date: string;
  status: InstallmentDisplayStatus;
}): InstallmentDisplayStatus => {
  if (installment.status === 'paid' || installment.status === 'missed') {
    return installment.status;
  }

  const dueDate = parseAppDate(installment.due_date);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < getTodayLocal()) {
    return 'late';
  }

  return installment.status;
};

export const isReceivableInstallment = (installment: {
  due_date: string;
  status: InstallmentDisplayStatus;
}) => {
  const displayStatus = getInstallmentDisplayStatus(installment);
  return displayStatus !== 'paid' && displayStatus !== 'missed';
};
