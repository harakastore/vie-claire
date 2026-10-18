import { describe,it,expect } from 'vitest';
import { correctedCreditPaid,remainingCredit,occursOn,calorieBalance,paymentSchema,hasCalorieEntry,creditPaymentState,creditStateClass } from '@/lib/tracking';
const base={active:true,start_date:'2026-10-18',end_date:null,selected_dates:[],frequency:'weekly',days_of_week:[0]};
describe('Tracking rules',()=>{
 it('Correcting 2000 to 1500 on a 5000 credit leaves 3500',()=>expect(remainingCredit(5000,correctedCreditPaid(5000,2000,2000,1500))).toBe(3500));
 it('Corrections retain older payments without dated entries',()=>expect(correctedCreditPaid(5000,3000,2000,1500)).toBe(2500));
 it('Corrections reject overpayment',()=>expect(()=>correctedCreditPaid(5000,3000,2000,4500)).toThrow());
 it('5000 DH minus a 2000 DH payment leaves 3000 DH',()=>expect(remainingCredit(5000,2000)).toBe(3000));
 it('Sunday routine appears every Sunday and not Monday',()=>{expect(occursOn(base,'2026-10-25')).toBe(true);expect(occursOn(base,'2026-10-26')).toBe(false)});
 it('Selected dates only appear on selected days',()=>{const r={...base,frequency:'once',selected_dates:['2026-10-21','2026-10-22']};expect(occursOn(r,'2026-10-21')).toBe(true);expect(occursOn(r,'2026-10-23')).toBe(false)});
 it('Monthly responsibilities repeat on their monthly date',()=>{const r={...base,frequency:'monthly'};expect(occursOn(r,'2026-11-18')).toBe(true);expect(occursOn(r,'2026-11-19')).toBe(false)});
 it('Annual responsibilities repeat on month and day',()=>{const r={...base,frequency:'annual'};expect(occursOn(r,'2027-10-18')).toBe(true);expect(occursOn(r,'2027-09-18')).toBe(false)});
 it('Recurring tasks stop at end date',()=>expect(occursOn({...base,end_date:'2026-10-24'},'2026-10-25')).toBe(false));
 it('Calories retain the established 2000 kcal base',()=>expect(calorieBalance(1800,300)).toBe(-500));
 it('Only explicitly logged calorie days count, including zero entries',()=>{expect(hasCalorieEntry({kcal_logged:true})).toBe(true);expect(hasCalorieEntry({kcal_logged:false})).toBe(false);expect(hasCalorieEntry(undefined)).toBe(false)});
 it('Payments must be positive',()=>expect(paymentSchema.safeParse({amount:0,date:'2026-10-18',method:'cheque',reference:''}).success).toBe(false));
 it('A credit with no payment is shown as unpaid (white row)',()=>{expect(creditPaymentState(5000,0)).toBe('unpaid');expect(creditStateClass.unpaid).toBe('credit-unpaid')});
 it('A credit partly paid is orange, fully repaid is green',()=>{expect(creditPaymentState(5000,2000)).toBe('partial');expect(creditStateClass.partial).toBe('credit-partial');expect(creditPaymentState(5000,5000)).toBe('settled');expect(creditStateClass.settled).toBe('credit-settled')});
});
