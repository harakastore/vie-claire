import { z } from 'zod';
import { parseISO, getDaysInMonth } from 'date-fns';
export const moneySchema = z.coerce.number().finite().nonnegative();
export const paymentSchema = z.object({ amount: z.coerce.number().finite().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), method: z.enum(['other','cash','transfer','cheque','effet']), reference: z.string().max(250) });
export function remainingCredit(amount: number, paid: number) { return Math.max(0, amount - paid); }
export function correctedCreditPaid(total:number,paid:number,oldPayment:number,newPayment:number){
  const result=paid-oldPayment+newPayment;
  if(!Number.isFinite(result)||newPayment<=0||result<0||result>total)throw new Error('Paiement invalide');
  return result;
}
export type CreditState = 'unpaid' | 'partial' | 'settled';
export function creditPaymentState(total: number, paid: number): CreditState {
  if (paid <= 0) return 'unpaid';
  return paid >= total ? 'settled' : 'partial';
}
export const creditStateClass: Record<CreditState, string> = { unpaid: 'credit-unpaid', partial: 'credit-partial', settled: 'credit-settled' };
export type Schedule = { active: boolean; start_date: string; end_date: string | null; selected_dates: string[]; frequency: string; days_of_week: number[] };
export function recurringTaskInBlock(task: { active: boolean; block_key: string; days_of_week: number[] | null }, date: string, block: string) {
  const day = parseISO(date).getDay();
  return task.active && task.block_key === block && (!task.days_of_week?.length || task.days_of_week.includes(day));
}
export function occursOn(item: Schedule, date: string) {
  if (!item.active || date < item.start_date || (item.end_date && date > item.end_date)) return false;
  if (item.selected_dates.includes(date)) return true;
  const d = parseISO(date), start = parseISO(item.start_date);
  if (item.frequency === 'once') return item.selected_dates.length ? false : date === item.start_date;
  if (item.frequency === 'weekly') return (item.days_of_week.length ? item.days_of_week : [start.getDay()]).includes(d.getDay());
  const matchesDay = d.getDate() === Math.min(start.getDate(), getDaysInMonth(d));
  if (item.frequency === 'monthly') return matchesDay;
  return item.frequency === 'annual' && d.getMonth() === start.getMonth() && matchesDay;
}
export const calorieBalance = (eaten: number, burned: number, basal = 2000) => eaten - basal - burned;
export const hasCalorieEntry = (row: { kcal_logged: boolean } | undefined) => row?.kcal_logged === true;
export const scheduleSchema = z.object({ title: z.string().trim().min(1).max(200), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end_date: z.string().nullable(), frequency: z.enum(['once','weekly','monthly','annual']), kind: z.enum(['responsibility','life']), days_of_week: z.array(z.number().int().min(0).max(6)), selected_dates: z.array(z.string()), block_key: z.string(), scheduled_time: z.string().nullable(), color: z.enum(['blue','violet','teal','rose']), active: z.boolean() }).refine(v => !v.end_date || v.end_date >= v.start_date, { message: 'La date de fin doit suivre le début.' });
