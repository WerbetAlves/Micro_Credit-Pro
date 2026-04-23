import { parseAppDate } from './date';

export type DashboardNotification = {
  id: string;
  type: 'payment' | 'loan' | 'client' | 'alert';
  title: string;
  message: string;
  timestamp: Date;
  route: string;
  isRead: boolean;
};

type InstallmentNotificationRow = {
  id: string;
  due_date: string;
  amount: number;
  status: 'upcoming' | 'paid' | 'late' | 'missed';
  loans?: {
    clients?: {
      full_name?: string | null;
    } | null;
  } | null;
};

type LoanNotificationRow = {
  id: string;
  created_at: string;
  principal_amount: number;
  status: 'pending' | 'active' | 'repaid' | 'default';
  clients?: {
    full_name?: string | null;
  } | null;
};

type ClientNotificationRow = {
  id: string;
  created_at: string;
  full_name: string;
};

type SupportTicketNotificationRow = {
  id: string;
  created_at: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getDiffInDays = (dueDate: string) => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = parseAppDate(dueDate);
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((startOfDue.getTime() - startOfToday.getTime()) / MS_PER_DAY);
};

const safeDate = (value?: string) => {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const buildDashboardNotifications = ({
  installments,
  loans,
  clients,
  supportTickets,
  readIds,
}: {
  installments: InstallmentNotificationRow[];
  loans: LoanNotificationRow[];
  clients: ClientNotificationRow[];
  supportTickets: SupportTicketNotificationRow[];
  readIds: string[];
}): DashboardNotification[] => {
  const notifications: DashboardNotification[] = [];
  const readSet = new Set(readIds);

  installments.forEach((installment) => {
    const clientName = installment.loans?.clients?.full_name || 'Cliente';
    const diffInDays = getDiffInDays(installment.due_date);
    const amount = Number(installment.amount || 0).toFixed(2);

    if (installment.status === 'late' || installment.status === 'missed') {
      notifications.push({
        id: `installment-${installment.id}-late`,
        type: 'alert',
        title: 'Parcela em atraso',
        message: `${clientName} possui uma parcela em atraso de R$ ${amount}.`,
        timestamp: safeDate(`${installment.due_date}T12:00:00`),
        route: '/payments',
        isRead: readSet.has(`installment-${installment.id}-late`),
      });
      return;
    }

    if (installment.status === 'upcoming' && diffInDays >= 0 && diffInDays <= 3) {
      notifications.push({
        id: `installment-${installment.id}-upcoming`,
        type: 'payment',
        title: diffInDays === 0 ? 'Recebimento vence hoje' : 'Recebimento proximo',
        message: `${clientName} tem uma parcela de R$ ${amount} vencendo em ${diffInDays === 0 ? 'hoje' : `${diffInDays} dia(s)`}.`,
        timestamp: safeDate(`${installment.due_date}T12:00:00`),
        route: '/calendar',
        isRead: readSet.has(`installment-${installment.id}-upcoming`),
      });
    }
  });

  loans
    .filter((loan) => loan.status === 'pending')
    .forEach((loan) => {
      const clientName = loan.clients?.full_name || 'Cliente';
      notifications.push({
        id: `loan-${loan.id}-pending`,
        type: 'loan',
        title: 'Emprestimo pendente',
        message: `Ha um emprestimo pendente para ${clientName} no valor de R$ ${Number(loan.principal_amount || 0).toFixed(2)}.`,
        timestamp: safeDate(loan.created_at),
        route: '/loans',
        isRead: readSet.has(`loan-${loan.id}-pending`),
      });
    });

  clients.slice(0, 5).forEach((client) => {
    notifications.push({
      id: `client-${client.id}-created`,
      type: 'client',
      title: 'Novo cliente cadastrado',
      message: `${client.full_name} entrou recentemente na sua base.`,
      timestamp: safeDate(client.created_at),
      route: '/clients',
      isRead: readSet.has(`client-${client.id}-created`),
    });
  });

  supportTickets
    .filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress')
    .forEach((ticket) => {
      notifications.push({
        id: `ticket-${ticket.id}-${ticket.status}`,
        type: 'alert',
        title: ticket.status === 'open' ? 'Ticket de suporte aberto' : 'Ticket em andamento',
        message: ticket.subject,
        timestamp: safeDate(ticket.created_at),
        route: '/support',
        isRead: readSet.has(`ticket-${ticket.id}-${ticket.status}`),
      });
    });

  return notifications
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 20);
};
