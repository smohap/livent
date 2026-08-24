import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/PageHeader';
import { Button, ErrorNote, Field, Loading, Meter, Panel, Select, StatCard, StatusTag } from '@/components/ui';
import { api } from '@/lib/api';
import { useEventContext } from '@/hooks/useEventContext';
import { cx, dayMonth, label, money, moneyShort } from '@/lib/format';
import type { BudgetView, Invoice } from '@/lib/types';

export function Budget() {
  const event = useEventContext();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const budget = useQuery({
    queryKey: ['budget', event.id],
    queryFn: () => api.get<BudgetView>(`/events/${event.id}/finance/budget`),
  });
  const invoices = useQuery({
    queryKey: ['invoices', event.id],
    queryFn: () => api.get<Invoice[]>(`/events/${event.id}/finance/invoices`),
  });

  const advance = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'pay' }) =>
      api.post(`/events/${event.id}/finance/invoices/${id}/advance`, { action }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['invoices', event.id] });
      queryClient.invalidateQueries({ queryKey: ['budget', event.id] });
      queryClient.invalidateQueries({ queryKey: ['health', event.id] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'Action failed'),
  });

  if (budget.isLoading) return <Loading label="Loading finances" />;

  const view = budget.data;
  if (!view) return <ErrorNote message="Could not load the budget" />;

  return (
    <>
      <PageHeader
        title="Budget & Invoices"
        sub={`${money(view.totalBudget, view.currency)} total budget`}
        actions={<Button onClick={() => setSubmitting(true)}>Submit invoice</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Budget" value={moneyShort(view.totals.budgeted, view.currency)} />
        <StatCard label="Committed" value={moneyShort(view.totals.committed, view.currency)} />
        <StatCard label="Paid" value={moneyShort(view.totals.paid, view.currency)} />
        <StatCard
          label="Outstanding"
          value={moneyShort(view.totals.outstanding, view.currency)}
          sub="Approved but not yet paid"
        />
      </div>

      <Panel className="mt-4">
        <h2 className="mb-4 text-base">By category</h2>
        <div className="space-y-4">
          {view.lines.map((line) => {
            const over = line.budgeted > 0 && line.committed > line.budgeted;
            return (
              <div key={line.id}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="text-white/80">{line.category}</span>
                  <span className={cx('text-xs', over ? 'text-white' : 'text-white/45')}>
                    {money(line.committed, view.currency)} committed of{' '}
                    {money(line.budgeted, view.currency)}
                    {over
                      ? ` - ${Math.round(((line.committed - line.budgeted) / line.budgeted) * 100)}% over`
                      : ''}
                  </span>
                </div>
                <Meter value={line.committed} max={Math.max(line.budgeted, line.committed) || 1} />
                <div className="mt-1 text-[0.66rem] text-white/35">
                  {money(line.paid, view.currency)} paid - {line.invoiceCount} invoice
                  {line.invoiceCount === 1 ? '' : 's'}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {actionError ? (
        <div className="mt-4">
          <ErrorNote message={actionError} />
        </div>
      ) : null}

      <Panel className="mt-4 overflow-x-auto">
        <h2 className="mb-4 text-base">Invoices</h2>
        {invoices.isLoading ? <Loading /> : null}
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[0.68rem] uppercase tracking-wider text-white/45">
              <th className="pb-3 pr-4">Invoice</th>
              <th className="pb-3 pr-4">Vendor</th>
              <th className="pb-3 pr-4">Category</th>
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3 pr-4">Due</th>
              <th className="pb-3 pr-4">Approval</th>
              <th className="pb-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.data?.map((invoice) => (
              <tr key={invoice.id} className="border-t border-white/[0.05]">
                <td className="py-3 pr-4 text-white/80">{invoice.number}</td>
                <td className="py-3 pr-4 text-white/55">{invoice.vendor?.name ?? '-'}</td>
                <td className="py-3 pr-4 text-white/55">{invoice.budgetLine?.category ?? '-'}</td>
                <td className="py-3 pr-4 text-white/80">
                  {money(invoice.amount + invoice.tax, view.currency)}
                </td>
                <td className="py-3 pr-4 text-white/45">{dayMonth(invoice.dueDate)}</td>
                <td className="py-3 pr-4">
                  <StatusTag status={invoice.approval}>{label(invoice.approval)}</StatusTag>
                </td>
                <td className="py-3">
                  <div className="flex gap-2">
                    {invoice.approval !== 'finance_approved' && invoice.approval !== 'rejected' ? (
                      <button
                        type="button"
                        onClick={() => advance.mutate({ id: invoice.id, action: 'approve' })}
                        className="text-xs text-white/60 transition hover:text-white"
                      >
                        Approve
                      </button>
                    ) : null}
                    {invoice.approval === 'finance_approved' && invoice.payment !== 'paid' ? (
                      <button
                        type="button"
                        onClick={() => advance.mutate({ id: invoice.id, action: 'pay' })}
                        className="text-xs text-white/60 transition hover:text-white"
                      >
                        Mark paid
                      </button>
                    ) : null}
                    {invoice.payment === 'paid' ? (
                      <span className="text-xs text-white/35">Settled</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {submitting ? (
        <SubmitInvoiceDialog eventId={event.id} lines={view.lines} onClose={() => setSubmitting(false)} />
      ) : null}
    </>
  );
}

function SubmitInvoiceDialog({
  eventId,
  lines,
  onClose,
}: {
  eventId: string;
  lines: BudgetView['lines'];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [number, setNumber] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [tax, setTax] = useState('');
  const [budgetLineId, setBudgetLineId] = useState(lines[0]?.id ?? '');
  const [dueDate, setDueDate] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/finance/invoices`, {
        number,
        description,
        amount: Number(amount) || 0,
        tax: Number(tax) || 0,
        budgetLineId: budgetLineId || null,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', eventId] });
      queryClient.invalidateQueries({ queryKey: ['budget', eventId] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Submit an invoice"
    >
      <div className="liquid-glass-strong w-full max-w-md rounded-[1.4rem] p-8">
        <h2 className="text-xl tracking-tight">
          Submit an <em>invoice</em>
        </h2>
        <p className="mt-1.5 text-xs text-white/45">
          Goes to the team lead, then the event manager, then finance.
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Invoice number" value={number} onChange={(e) => setNumber(e.target.value)} required placeholder="INV-204" />
          <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Field label="Tax" type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
          <Select label="Budget category" value={budgetLineId} onChange={(e) => setBudgetLineId(e.target.value)}>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.category}
              </option>
            ))}
          </Select>
          <Field label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

          {create.error ? (
            <ErrorNote message={create.error instanceof Error ? create.error.message : 'Could not submit'} />
          ) : null}

          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
