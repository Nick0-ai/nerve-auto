# NERVE Engine - Supabase Edge Functions

## Déploiement

Pour déployer les Edge Functions, utilisez la CLI Supabase :

```bash
# Installer Supabase CLI si nécessaire
npm install -g supabase

# Se connecter à votre projet
supabase link --project-ref zomtudzqlwyewfhczrkp

# Déployer toutes les fonctions
supabase functions deploy scrape-gpu-prices
supabase functions deploy scrape-weather
supabase functions deploy scrape-carbon
supabase functions deploy get-region-data
supabase functions deploy simulate
supabase functions deploy timeshift-plan
supabase functions deploy checkpoint-simulate
supabase functions deploy dashboard-stats
supabase functions deploy ws-feed
```

## Structure

- `_shared/` - Types et utilitaires partagés
- Chaque fonction a son propre dossier avec `index.ts` et `deno.json`

## Variables d'environnement

Les fonctions utilisent automatiquement :
- `SUPABASE_URL` - Défini automatiquement par Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Défini automatiquement par Supabase

## Endpoints

Toutes les fonctions sont accessibles via :
`https://zomtudzqlwyewfhczrkp.supabase.co/functions/v1/[function-name]`

## Migration SQL

N'oubliez pas d'appliquer la migration SQL :
```bash
supabase db push
```

Ou via le dashboard Supabase : appliquer `supabase/migrations/001_create_nerve_tables.sql`
