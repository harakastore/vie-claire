import { describe,it,expect } from 'vitest';
import { remainingCredit,occursOn,calorieBalance,paymentSchema,hasCalorieEntry } from '@/lib/tracking';
const base={active:true,start_date:'2026-10-18',end_date:null,selected_dates:[],frequency:'weekly',days_of_week:[0]};
describe('Tracking rules',()=>{
 it('5000 DH minus a 2000 DH payment leaves 3000 DH',()=>expect(remainingCredit(5000,2000)).toBe(3000));
 it('Sunday routine appears every Sunday and not Monday',()=>{expect(occursOn(base,'2026-10-25')).toBe(true);expect(occursOn(base,'2026-10-26')).toBe(false)});
 it('Selected dates only appear on selected days',()=>{const r={...base,frequency:'once',selected_dates:['2026-10-21','2026-10-22']};expect(occursOn(r,'2026-10-21')).toBe(true);expect(occursOn(r,'2026-10-23')).toBe(false)});
 it('Monthly responsibilities repeat on their monthly date',()=>{const r={...base,frequency:'monthly'};expect(occursOn(r,'2026-11-18')).toBe(true);expect(occursOn(r,'2026-11-19')).toBe(false)});
 it('Annual responsibilities repeat on month and day',()=>{const r={...base,frequency:'annual'};expect(occursOn(r,'2027-10-18')).toBe(true);expect(occursOn(r,'2027-09-18')).toBe(false)});
 it('Recurring tasks stop at end date',()=>expect(occursOn({...base,end_date:'2026-10-24'},'2026-10-25')).toBe(false));
 it('Calories retain the established 2000 kcal base',()=>expect(calorieBalance(1800,300)).toBe(-500));
 it('Only explicitly logged calorie days count, including zero entries',()=>{expect(hasCalorieEntry({kcal_logged:true})).toBe(true);expect(hasCalorieEntry({kcal_logged:false})).toBe(false);expect(hasCalorieEntry(undefined)).toBe(false)});
 it('Payments must be positive',()=>expect(paymentSchema.safeParse({amount:0,date:'2026-10-18',method:'cheque',reference:''}).success).toBe(false));
});
