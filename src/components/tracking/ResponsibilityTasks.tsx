import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { occursOn } from '@/lib/tracking';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Heart, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
export const scheduleColors: Record<string,string>={blue:'bg-primary/10 border-primary/30 text-primary',violet:'schedule-violet',teal:'bg-secondary/15 border-secondary/30 text-foreground',rose:'schedule-rose'};
export function ResponsibilityTasks({dateStr,blockKey}:{dateStr:string;blockKey:string}){
 const {user}=useAuth();const client=useQueryClient();
 const {data:items=[]}=useQuery({queryKey:['responsibilities',user?.id],enabled:!!user,queryFn:async()=>{const {data,error}=await supabase.from('responsibilities').select('*').eq('user_id',user?.id||'');if(error)throw error;return data||[]}});
 const key=['responsibility-logs',user?.id,dateStr];const {data:logs=[]}=useQuery({queryKey:key,enabled:!!user,queryFn:async()=>{const {data,error}=await supabase.from('responsibility_logs').select('*').eq('day_date',dateStr).eq('user_id',user?.id||'');if(error)throw error;return data||[]}});
 async function toggle(id:string,done:boolean){if(!user)return;const previous=logs;client.setQueryData(key,[...logs.filter(l=>l.responsibility_id!==id),{id:'pending',user_id:user.id,responsibility_id:id,day_date:dateStr,completed:!done}]);const {error}=await supabase.from('responsibility_logs').upsert({user_id:user.id,responsibility_id:id,day_date:dateStr,completed:!done},{onConflict:'user_id,responsibility_id,day_date'});if(error){client.setQueryData(key,previous);toast.error('La case n’a pas pu être enregistrée');}else{client.invalidateQueries({queryKey:['responsibility-tracker']});client.invalidateQueries({queryKey:['responsibility-history']});}}
 return <>{items.filter(i=>i.block_key===blockKey&&occursOn(i,dateStr)).map(i=>{const done=logs.some(l=>l.responsibility_id===i.id&&l.completed);const Icon=i.kind==='life'?Heart:CalendarCheck;return <label key={i.id} className={cn('flex items-start gap-2 rounded-sm border p-3 cursor-pointer',scheduleColors[i.color])}><Checkbox checked={done} onCheckedChange={()=>toggle(i.id,done)} aria-label={i.title}/><span className={cn('flex-1 text-sm font-semibold break-words',done&&'line-through opacity-60')}>{i.scheduled_time?.slice(0,5)} {i.title}</span><Icon className="h-4 w-4 shrink-0"/></label>})}</>
}
