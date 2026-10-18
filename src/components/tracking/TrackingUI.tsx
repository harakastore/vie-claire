import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export function Choice({ value, onChange, options, label }: {value: string; onChange: (v: string) => void; options: Record<string,string>; label: string}) {
 return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{Object.entries(options).map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>;
}
export function Metrics({ items }: {items: {label:string;value:string;detail?:string}[]}) {
 return <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 border-y py-5">{items.map(i=><div key={i.label} className="min-w-0"><p className="text-xs text-muted-foreground font-semibold uppercase">{i.label}</p><p className="text-2xl font-bold tabular-nums mt-2 break-words">{i.value}</p>{i.detail&&<p className="text-xs text-muted-foreground mt-1">{i.detail}</p>}</div>)}</div>;
}
export const money = (v: number) => v.toLocaleString('fr-FR', {maximumFractionDigits:2})+' DH';
