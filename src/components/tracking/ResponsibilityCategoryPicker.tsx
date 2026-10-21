import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Choice } from './TrackingUI';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const fieldType = 'responsibility_category';
export function useResponsibilityCategories(assigned: string[]) {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ['responsibility-categories', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('autocomplete_library').select('value')
        .eq('user_id', user.id).eq('field_type', fieldType).order('value');
      if (error) throw error;
      return (data || []).map(item => item.value);
    },
  });
  return Array.from(new Set([...data, ...assigned].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
}

export function ResponsibilityCategoryPicker({ value, onChange, categories }: {
  value: string; onChange: (value: string) => void; categories: string[];
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  async function create() {
    const category = name.trim();
    if (!user || !category || saving) return;
    const key = ['responsibility-categories', user.id];
    const previous = client.getQueryData<string[]>(key);
    client.setQueryData<string[]>(key, old => Array.from(new Set([...(old || []), category])));
    setSaving(true);
    const { error } = await supabase.from('autocomplete_library').upsert({
      user_id: user.id, field_type: fieldType, value: category, last_used_at: new Date().toISOString(),
    }, { onConflict: 'user_id,field_type,value' });
    if (error) {
      client.setQueryData(key, previous || []);
      toast.error('La catégorie n’a pas pu être créée');
    } else {
      onChange(category);
      setName('');
    }
    setSaving(false);
  }
  return <div className="space-y-2">
    <Choice label="Catégorie de la responsabilité" value={value ? `category:${value}` : 'none'}
      onChange={v => onChange(v === 'none' ? '' : v.slice(9))}
      options={{ none: 'Sans catégorie', ...Object.fromEntries(Array.from(new Set([...categories, value].filter(Boolean))).map(c => [`category:${c}`, c])) }} />
    <div className="flex gap-2">
      <Input aria-label="Nouvelle catégorie" placeholder="Nouvelle catégorie…" value={name} maxLength={100}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void create(); } }} />
      <Button type="button" variant="outline" disabled={saving || !name.trim()} onClick={create}>
        <Plus className="h-4 w-4 mr-2" />Créer
      </Button>
    </div>
  </div>;
}