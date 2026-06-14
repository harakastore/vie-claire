Je vais ajouter 3 nouvelles sections majeures à l'app, chacune comme une page dédiée accessible depuis la sidebar.

## Partie 1 : Cabinet (page `/cabinet`)
Page avec onglets (Tabs shadcn) :
- **À faire** : liste de tâches générales du cabinet
- **Maintenance** : tâches ponctuelles + routine récurrente (quotidienne/hebdo/mensuelle)
- **Brainstorming Marketing** : idées libres en vrac (capture rapide)
- **Stratégies Marketing prioritaires** : liste avec priorité (haute/moyenne/basse) + description détaillée + statut
- **SOPs & Process** : liste des procédures à poser/améliorer, avec statut (à créer / en cours / posé)
- **Roadmap** : étapes avec dates choisies (date picker), ordre chronologique, statut
- **Vision 2 ans** : champ texte long éditable (une seule vision)
- **CNSS** : suivi paiements (montant dû total, montant payé, reste) + simulateur "si je paye X par mois, combien de temps pour finir"

## Partie 2 : Moi-même (page `/moi-meme`)
Onglets :
- **À acheter** : liste shopping perso (nom, quantité, priorité, acheté oui/non)
- **Habitudes à changer** : mauvaises habitudes à éliminer (statut progression)
- **Standards** : standards envers soi-même et envers les autres (deux sous-listes)
- **Bonnes habitudes à implémenter** : nouvelles habitudes (statut implémentée oui/non)
- **Spiritualité (Islam)** : pratiques islamiques à appliquer pour meilleure version vis-à-vis de Dieu (statut)

## Partie 3 : Apprentissage (page `/apprentissage`)
Liste de choses à apprendre, organisée par catégorie :
- Langues, E-commerce, Gestion team & humain, Communication & élocution, Développement personnel, En tant que mari, + catégories custom
- Chaque item : titre, catégorie, ressource/lien optionnel, progression (à commencer / en cours / terminé), notes

## Détails techniques
Nouvelles tables Supabase (toutes avec RLS par `user_id`, GRANT authenticated) :
- `cabinet_tasks` (type: todo|maintenance|maintenance_routine|brainstorm|sop, title, description, priority, status, frequency)
- `cabinet_marketing_strategies` (title, description, priority, status, order_index)
- `cabinet_roadmap` (title, description, target_date, status, order_index)
- `cabinet_vision` (vision_text) — 1 ligne par user
- `cnss_payments` (amount, paid_at, note)
- `cnss_config` (total_due) — 1 ligne par user
- `personal_items` (type: shopping|bad_habit|standard_self|standard_others|good_habit|islamic, title, description, priority, status)
- `learning_items` (category, title, resource_url, status, notes, order_index)

Navigation : 3 nouvelles entrées dans `AppSidebar` (Cabinet, Moi-même, Apprentissage) avec icônes lucide (Briefcase, User, GraduationCap).

UI : shadcn Tabs sur chaque page, dialogs/sheets pour ajout/édition, double-clic pour renommer (selon mémoire projet), optimistic UI, langue française, badges secteur quand pertinent.

## Question
Avant de lancer (3 pages + 8 tables = changement conséquent) : tu confirmes que je crée tout d'un bloc, ou tu préfères qu'on commence par **Partie 1 Cabinet** seulement puis Partie 2 et 3 ensuite ?