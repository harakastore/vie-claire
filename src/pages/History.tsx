import { PageHeader } from '@/components/PageHeader';
import { ActivityList } from '@/components/tracking/ActivityList';
export default function History(){return <div className="space-y-6"><PageHeader title="Historique" description="Dépenses, revenus, crédits et engagements"/><p className="text-sm text-muted-foreground">Les changements sont enregistrés depuis le 18 octobre 2026. Les opérations antérieures n’ont pas d’historique détaillé.</p><ActivityList/></div>}
