import { Request, Response, NextFunction } from 'express';
import { sql } from '../db/client';
import { buildLeadFilterClause } from '../services/filters';
import { buildVisibilityClause } from '../services/visibility';
import {
  QueryLeadsBodySchema,
  QueryLeadsParamsSchema,
  LeadRow,
  CustomFieldValueRow,
  LeadResponse,
  isSystemField,
  QueryLeadsBody,
} from '../types/lead-filter';
import { BadRequestError } from '../errors';

async function validateCustomFields(
  filters: QueryLeadsBody['filters'],
  tenantId: string,
): Promise<void> {
  const customFieldIds = [
    ...new Set(
      (filters || [])
        .filter((filter) => !isSystemField(filter.fieldId))
        .map((filter) => filter.fieldId),
    ),
  ];

  if (customFieldIds.length === 0) {
    return;
  }

  const rows = await sql`
    SELECT id, type, status
    FROM custom_fields
    WHERE tenant_id = ${tenantId}
      AND id IN ${sql(customFieldIds)}
  `;

  const fieldMap = new Map(
    rows.map((row) => [
      row.id as string,
      {
        type: row.type as string,
        status: row.status as boolean,
      },
    ]),
  );

  for (const fieldId of customFieldIds) {
    const field = fieldMap.get(fieldId);

    if (!field) {
      throw new BadRequestError(`Unknown custom field "${fieldId}" for this tenant`);
    }

    if (!field.status) {
      throw new BadRequestError(`Custom field "${fieldId}" is inactive`);
    }

    const requestedFilter = (filters || []).find((filter) => filter.fieldId === fieldId);

    if (requestedFilter && requestedFilter.fieldType !== field.type) {
      throw new BadRequestError(
        `Custom field "${fieldId}" expects fieldType "${field.type}", got "${requestedFilter.fieldType}"`,
      );
    }
  }
}

// id-then-hydrate: get matching IDs, then fetch full rows + custom fields in bulk
export async function queryLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.currentUser!;

    const paramsResult = QueryLeadsParamsSchema.safeParse(req.query);
    if (!paramsResult.success) {
      const msg = paramsResult.error.errors.map((e) => e.message).join('; ');
      throw new BadRequestError(msg);
    }
    const { page, limit, sortBy, sortDirection } = paramsResult.data;

    const bodyResult = QueryLeadsBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      const msg = bodyResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new BadRequestError(msg);
    }
    const { q, logic, filters } = bodyResult.data;

    await validateCustomFields(filters, user.tenantId);

    const conditions: string[] = [];
    const values: unknown[] = [];

    values.push(user.tenantId);
    conditions.push(`leads.tenant_id = $${values.length}`);

    const vis = buildVisibilityClause(user, values.length + 1);
    if (vis.sql) {
      vis.values.forEach((v) => values.push(v));
      conditions.push(vis.sql);
    }

    const qTrimmed = q?.trim();
    if (qTrimmed) {
      const p = values.length + 1;
      const pattern = `%${qTrimmed.replace(/[%_\\]/g, '\\$&')}%`;
      values.push(pattern);
      conditions.push(
        `(leads.name ILIKE $${p} OR leads.phone ILIKE $${p} OR leads.email ILIKE $${p} OR leads.e164 ILIKE $${p})`,
      );
    }

    if (filters && filters.length > 0) {
      const filterClause = buildLeadFilterClause(filters, logic ?? 'AND', values.length + 1);
      filterClause.values.forEach((v) => values.push(v));
      if (filterClause.sql) {
        conditions.push(`(${filterClause.sql})`);
      }
    }

    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortColumn = sortBy === 'followUpDate' ? 'leads.follow_up_date' : 'leads.created_at';
    const nullsDirective = sortBy === 'followUpDate' && sortDirection === 'asc' ? ' NULLS LAST' : '';
    const orderSQL = `ORDER BY ${sortColumn} ${sortDirection.toUpperCase()}${nullsDirective}, leads.id ASC`;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM leads
      ${whereSQL}
    `;

    const idsQuery = `
      SELECT leads.id
      FROM leads
      ${whereSQL}
      ${orderSQL}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const [countResult, idRows] = await Promise.all([
      sql.unsafe(countQuery, values as string[]),
      sql.unsafe(idsQuery, [...values, limit, offset] as string[]),
    ]);

    const totalRecords = parseInt((countResult[0] as unknown as { total: string }).total, 10);
    const totalPages = Math.ceil(totalRecords / limit);
    const pageIds = (idRows as unknown as { id: string }[]).map((r) => r.id);

    if (pageIds.length === 0) {
      res.json({
        status: 'success',
        message: 'Leads fetched successfully',
        data: [],
        meta: { page, limit, totalRecords, totalPages },
      });
      return;
    }

    const idPlaceholders = pageIds.map((_, i) => `$${i + 1}`).join(', ');

    const leadsQuery = `
      SELECT
        leads.id,
        leads.tenant_id,
        leads.user_id,
        leads.name,
        leads.phone,
        leads.country_code,
        leads.e164,
        leads.email,
        leads.assigned_to,
        leads.follow_up_date,
        leads.created_at,
        leads.updated_at
      FROM leads
      WHERE leads.id IN (${idPlaceholders})
      ORDER BY ARRAY_POSITION(ARRAY[${idPlaceholders}]::uuid[], leads.id::uuid)
    `;

    const cfQuery = `
      SELECT
        lcfv.lead_id,
        lcfv.field_id,
        cf.label,
        lcfv.value
      FROM lead_custom_field_values lcfv
      JOIN custom_fields cf ON cf.id = lcfv.field_id
      WHERE lcfv.lead_id IN (${idPlaceholders})
        AND cf.status = TRUE
        AND cf.tenant_id = $${pageIds.length + 1}
    `;

    const [leadRows, cfRows] = await Promise.all([
      sql.unsafe(leadsQuery, pageIds as string[]),
      sql.unsafe(cfQuery, [...pageIds, user.tenantId] as string[]),
    ]);

    const cfByLead = new Map<string, Array<{ fieldId: string; label: string; value: string }>>();
    for (const cf of cfRows as unknown as CustomFieldValueRow[]) {
      if (!cfByLead.has(cf.lead_id)) cfByLead.set(cf.lead_id, []);
      cfByLead.get(cf.lead_id)!.push({
        fieldId: cf.field_id,
        label: cf.label,
        value: cf.value,
      });
    }

    const data: LeadResponse[] = (leadRows as unknown as LeadRow[]).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      name: row.name,
      phone: row.phone,
      countryCode: row.country_code,
      e164: row.e164,
      email: row.email,
      assignedTo: row.assigned_to,
      followUpDate: row.follow_up_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customFields: cfByLead.get(row.id) ?? [],
    }));

    res.json({
      status: 'success',
      message: 'Leads fetched successfully',
      data,
      meta: { page, limit, totalRecords, totalPages },
    });
  } catch (err) {
    next(err);
  }
}
