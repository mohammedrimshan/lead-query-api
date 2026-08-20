# Lead Query API

Multi-tenant CRM lead filter service — Express + TypeScript + PostgreSQL.

## Quick reference UUIDs

Use these in the curl examples below.

| Entity | UUID |
|---|---|
| Tenant A | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` |
| Tenant B | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` |
| Admin (Tenant A) | `00000000-0000-0000-0000-000000000001` |
| Agent A1 | `11111111-1111-1111-1111-111111111111` |
| Agent A2 | `22222222-2222-2222-2222-222222222222` |
| City custom field | `ffffffff-ffff-ffff-ffff-ffffffffffff` |

Seed leads (Tenant A):

| Lead | Name | Phone | Assigned to | Follow-up | City |
|---|---|---|---|---|---|
| L1 | Ram Kumar | 9000000001 | Agent A1 | 2026-08-10 | Chennai |
| L2 | Ramesh | 9000000002 | Agent A1 | 2026-07-01 | Madurai |
| L3 | Priya | 9000000003 | Agent A2 | — | Chennai |
| L4 | Anand | 9000000004 | — | 2026-08-15 | Coimbatore |
| L5 | Sita | 9000000005 | Agent A2 | 2026-08-01 | Chennai |

Tenant B has two leads (Charlie, Delta) that must never show up in Tenant A queries.

## Setup

**Requirements:** Node 20+, PostgreSQL 14+

```bash
npm install
cp .env.example .env
# set DATABASE_URL in .env, e.g.:
# DATABASE_URL=postgres://postgres:password@localhost:5432/lead_query_db
```

Create the database, run migrations, then seed:

```bash
psql -U postgres -c "CREATE DATABASE lead_query_db;"
npm run migrate
npm run seed
```

Start the server:

```bash
npm run dev       # dev with hot reload
npm run build && npm start  # production
```

Runs on `http://localhost:3000` by default. Override with `PORT=` in `.env`.

## Example curls

Replace the UUID values with the ones from the table above (or export them as shell variables first).

**City contains "Chennai" AND assigned to Agent A2 — expect L3, L5**

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=1&limit=20' \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{
    "logic": "AND",
    "filters": [
      {
        "fieldId": "ffffffff-ffff-ffff-ffff-ffffffffffff",
        "fieldType": "string",
        "condition": "contain",
        "value": "Chennai"
      },
      {
        "fieldId": "assignedTo",
        "fieldType": "string",
        "condition": "is",
        "value": "22222222-2222-2222-2222-222222222222",
        "inputType": "multiselect"
      }
    ]
  }'
```

**Agent A1 searching "Ram" — only sees own leads L1, L2**

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?sortBy=followUpDate&sortDirection=asc' \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-user-role: agent' \
  -d '{"q": "Ram"}'
```

**OR filter — name contains "Ram" OR "Sita", expect L1, L2, L5**

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{
    "logic": "OR",
    "filters": [
      {"fieldId": "name", "fieldType": "string", "condition": "contain", "value": "Ram"},
      {"fieldId": "name", "fieldType": "string", "condition": "contain", "value": "Sita"}
    ]
  }'
```

**Pagination — page 2, 2 per page**

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=2&limit=2' \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{}'
```

**Invalid operator → 400**

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{"filters":[{"fieldId":"name","fieldType":"string","condition":"greater than","value":"x"}]}'
```

**Missing headers → 401**

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## API

`POST /api/v1/leads/query`

Required headers:
```
x-tenant-id:  <uuid>
x-user-id:    <uuid>
x-user-role:  owner | admin | manager | agent
```

Query params (all optional):

| Param | Default | Values |
|---|---|---|
| `page` | `1` | integer ≥ 1 |
| `limit` | `20` | 1–100 |
| `sortBy` | `createdAt` | `createdAt`, `followUpDate` |
| `sortDirection` | `desc` | `asc`, `desc` |

Request body:
```json
{
  "q": "search term",
  "logic": "AND",
  "filters": [
    {
      "fieldId": "name",
      "fieldType": "string",
      "condition": "contain",
      "value": "Ram"
    }
  ]
}
```

`fieldId` is either a system field name (`name`, `email`, `assignedTo`, `createdBy`, `followUpDate`, `createdAt`, `updatedAt`) or a custom field UUID.

Success response:
```json
{
  "status": "success",
  "message": "Leads fetched successfully",
  "data": [...],
  "meta": { "page": 1, "limit": 20, "totalRecords": 5, "totalPages": 1 }
}
```

Errors return `{ "message": "...", "statusCode": 400 }`.

## Design notes

**Why raw SQL instead of an ORM**

The filter DSL needs dynamically composed WHERE clauses — `AND`/`OR` logic, system columns, EAV subqueries, multiselect UUIDs. Every ORM I looked at requires escape hatches for this kind of thing anyway, so raw parameterized SQL with the `postgres` driver was the cleaner call.

**How hydration works (no N+1)**

1. Run the filter query, get a page of matching IDs
2. Fetch full lead rows for those IDs
3. Fetch all custom field values for those IDs in one query, then group in memory

Three queries regardless of how many leads or custom fields there are.

**Tenant isolation**

`tenant_id = $1` is always the first condition. Nothing can run without it.

**"is empty" for custom fields**

Means no row exists in `lead_custom_field_values` for that `(lead_id, field_id)` pair. A row with `value = ''` counts as having a value. This is documented consistently across the filter builder.

**Indexes**

All defined in `src/db/schema.ts`. The important ones:
- `leads(tenant_id)` — every query starts here
- `leads(tenant_id, assigned_to)` — agent visibility + assignedTo filter
- `leads(tenant_id, created_at DESC)` — default sort
- `leads(tenant_id, follow_up_date)` — followUpDate sort/filter
- `lead_custom_field_values(field_id, value, lead_id)` — covering index for EXISTS subqueries

**What I'd do with more time**

- Integration tests with supertest covering the verification scenarios
- Keyset/cursor pagination instead of OFFSET for large datasets
- Cache active custom field metadata per tenant (currently a DB round-trip per request)

## Project structure

```
src/
├── index.ts                # entry point
├── app.ts                  # express setup
├── errors.ts               # error classes
├── constants/
│   ├── http.ts
│   └── messages.ts
├── middleware/
│   ├── auth.ts             # reads x-* headers → req.currentUser
│   └── error-handler.ts
├── db/
│   ├── client.ts           # postgres singleton
│   ├── schema.ts           # DDL + indexes
│   ├── migrate.ts
│   └── seed.ts
├── types/
│   └── lead-filter.ts      # zod schemas + TS types
├── services/
│   ├── filters.ts          # buildLeadFilterClause
│   └── visibility.ts       # role-based WHERE clause
├── controllers/
│   └── queryLeads.ts
└── routes/
    └── leads.ts
```

## Time spent

About 6–7 hours:
- Schema and seed: 30 min
- Filter clause builder: 2.5 hrs (most of the complexity is here)
- Controller, SQL composition: 1.5 hrs
- Middleware, validation, error handling: 45 min
- README and testing curls: 45 min
