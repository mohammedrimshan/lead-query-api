import { BadRequestError } from '../errors';
import {
  LeadFilter,
  SYSTEM_FIELD_MAP,
  AGENT_FIELDS,
  DATE_FIELDS,
  isSystemField,
} from '../types/lead-filter';

export interface SqlClause {
  sql: string;
  values: unknown[];
}

// helpers

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

function requireValue(
  value: string | undefined,
  condition: string,
): string {
  if (value === undefined || value.trim() === '') {
    throw new BadRequestError(
      `value is required for condition "${condition}"`,
    );
  }
  return value.trim();
}

// rejects non-existent dates like 2026-02-30
function parseDate(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new BadRequestError(
      `Invalid date value "${value ?? ''}". Expected format: YYYY-MM-DD`,
    );
  }

  const date = value.trim();
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new BadRequestError(
      `Invalid date value "${value}". Expected a valid YYYY-MM-DD date`,
    );
  }

  return date;
}

// validates before postgres tries to cast the EAV text value to numeric
function parseNumber(value: string | undefined): string {
  const normalized = requireValue(value, 'number');

  if (!Number.isFinite(Number(normalized))) {
    throw new BadRequestError(
      `Invalid number value "${value}". Expected a valid number`,
    );
  }

  return normalized;
}

function parseBoolean(value: string | undefined): 'true' | 'false' {
  const normalized = value?.trim().toLowerCase();

  if (normalized !== 'true' && normalized !== 'false') {
    throw new BadRequestError(
      `Invalid boolean value "${value ?? ''}". Expected true or false`,
    );
  }

  return normalized;
}

function placeholders(startIndex: number, count: number): string {
  return Array.from({ length: count }, (_, i) => `$${startIndex + i}`).join(', ');
}

// system field (column) clause builders

function buildStringClause(
  column: string,
  condition: string,
  value: string | undefined,
  nullable: boolean,
  paramOffset: number,
): SqlClause {
  switch (condition) {
    case 'is': {
      const v = requireValue(value, condition);
      return { sql: `LOWER(${column}) = LOWER($${paramOffset})`, values: [v] };
    }
    case 'is not': {
      const v = requireValue(value, condition);
      if (nullable) {
        return { sql: `(${column} IS NULL OR LOWER(${column}) != LOWER($${paramOffset}))`, values: [v] };
      }
      return { sql: `LOWER(${column}) != LOWER($${paramOffset})`, values: [v] };
    }
    case 'contain': {
      const v = requireValue(value, condition);
      return { sql: `${column} ILIKE $${paramOffset}`, values: [`%${escapeLike(v)}%`] };
    }
    case 'does not contain': {
      const v = requireValue(value, condition);
      if (nullable) {
        return { sql: `(${column} IS NULL OR ${column} NOT ILIKE $${paramOffset})`, values: [`%${escapeLike(v)}%`] };
      }
      return { sql: `${column} NOT ILIKE $${paramOffset}`, values: [`%${escapeLike(v)}%`] };
    }
    case 'starts with': {
      const v = requireValue(value, condition);
      return { sql: `${column} ILIKE $${paramOffset}`, values: [`${escapeLike(v)}%`] };
    }
    case 'ends with': {
      const v = requireValue(value, condition);
      return { sql: `${column} ILIKE $${paramOffset}`, values: [`%${escapeLike(v)}`] };
    }
    case 'is empty':
      if (nullable) {
        return { sql: `(${column} IS NULL OR ${column} = '')`, values: [] };
      }
      return { sql: `${column} = ''`, values: [] };
    case 'is not empty':
      if (nullable) {
        return { sql: `(${column} IS NOT NULL AND ${column} != '')`, values: [] };
      }
      return { sql: `${column} != ''`, values: [] };
    default:
      throw new BadRequestError(`Condition "${condition}" is not supported for string fields`);
  }
}

function buildAgentClause(
  column: string,
  condition: string,
  value: string | undefined,
  inputType: string | undefined,
  paramOffset: number,
): SqlClause {
  const isNullable = column === 'leads.assigned_to';

  const uuids = (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  switch (condition) {
    case 'is':
    case 'contain': {
      if (uuids.length === 0) throw new BadRequestError(`value is required for condition "${condition}" on agent field`);
      if (inputType === 'multiselect' || uuids.length > 1) {
        const ph = placeholders(paramOffset, uuids.length);
        return { sql: `${column} IN (${ph})`, values: uuids };
      }
      return { sql: `${column} = $${paramOffset}`, values: [uuids[0]] };
    }
    case 'is not':
    case 'does not contain': {
      if (uuids.length === 0) throw new BadRequestError(`value is required for condition "${condition}" on agent field`);
      const ph = placeholders(paramOffset, uuids.length);
      if (isNullable) {
        return { sql: `(${column} IS NULL OR ${column} NOT IN (${ph}))`, values: uuids };
      }
      return { sql: `${column} NOT IN (${ph})`, values: uuids };
    }
    case 'is empty':
      if (!isNullable) throw new BadRequestError('"is empty" is only supported for the assignedTo field');
      return { sql: `${column} IS NULL`, values: [] };
    case 'is not empty':
      if (!isNullable) throw new BadRequestError('"is not empty" is only supported for the assignedTo field');
      return { sql: `${column} IS NOT NULL`, values: [] };
    default:
      throw new BadRequestError(`Condition "${condition}" is not supported for agent fields`);
  }
}

function buildDateClause(
  column: string,
  condition: string,
  value: string | undefined,
  nullable: boolean,
  paramOffset: number,
): SqlClause {
  switch (condition) {
    case 'before': {
      const d = parseDate(value);
      return { sql: `${column} < $${paramOffset}`, values: [d] };
    }
    case 'after': {
      const d = parseDate(value);
      return { sql: `${column} > $${paramOffset}`, values: [d] };
    }
    case 'is': {
      const d = parseDate(value);
      if (column.includes('created_at') || column.includes('updated_at')) {
        return { sql: `DATE(${column}) = $${paramOffset}`, values: [d] };
      }
      return { sql: `${column} = $${paramOffset}`, values: [d] };
    }
    case 'is empty':
      if (!nullable) throw new BadRequestError(`"is empty" is not applicable to ${column}`);
      return { sql: `${column} IS NULL`, values: [] };
    case 'is not empty':
      if (!nullable) throw new BadRequestError(`"is not empty" is not applicable to ${column}`);
      return { sql: `${column} IS NOT NULL`, values: [] };
    default:
      throw new BadRequestError(`Condition "${condition}" is not supported for date fields`);
  }
}

// EAV (custom field) clause builder — uses EXISTS/NOT EXISTS against lead_custom_field_values

function buildCustomFieldClause(
  filter: LeadFilter,
  paramOffset: number,
): SqlClause {
  const { fieldId, fieldType, condition, value } = filter;

  const existsClause = (extraCondition: string) => `EXISTS (
    SELECT 1 FROM lead_custom_field_values lcfv
    WHERE lcfv.lead_id = leads.id
      AND lcfv.field_id = $${paramOffset}
      ${extraCondition}
  )`;

  const notExistsClause = `NOT EXISTS (
    SELECT 1 FROM lead_custom_field_values lcfv
    WHERE lcfv.lead_id = leads.id
      AND lcfv.field_id = $${paramOffset}
  )`;

  switch (fieldType) {
    case 'string': {
      switch (condition) {
        case 'is': {
          const v = requireValue(value, condition);
          return {
            sql: existsClause(`AND LOWER(lcfv.value) = LOWER($${paramOffset + 1})`),
            values: [fieldId, v],
          };
        }
        case 'is not': {
          const v = requireValue(value, condition);
          // fieldId appears twice: once for NOT EXISTS, once for the inner EXISTS subquery
          return {
            sql: `(${notExistsClause} OR ${existsClause(`AND LOWER(lcfv.value) != LOWER($${paramOffset + 1})`)})`,
            values: [fieldId, fieldId, v],
          };
        }
        case 'contain': {
          const v = requireValue(value, condition);
          return {
            sql: existsClause(`AND lcfv.value ILIKE $${paramOffset + 1}`),
            values: [fieldId, `%${escapeLike(v)}%`],
          };
        }
        case 'does not contain': {
          const v = requireValue(value, condition);
          // fieldId appears twice: once for NOT EXISTS, once for the inner EXISTS subquery
          return {
            sql: `(${notExistsClause} OR ${existsClause(`AND lcfv.value NOT ILIKE $${paramOffset + 1}`)})`,
            values: [fieldId, fieldId, `%${escapeLike(v)}%`],
          };
        }
        case 'starts with': {
          const v = requireValue(value, condition);
          return {
            sql: existsClause(`AND lcfv.value ILIKE $${paramOffset + 1}`),
            values: [fieldId, `${escapeLike(v)}%`],
          };
        }
        case 'ends with': {
          const v = requireValue(value, condition);
          return {
            sql: existsClause(`AND lcfv.value ILIKE $${paramOffset + 1}`),
            values: [fieldId, `%${escapeLike(v)}`],
          };
        }
        case 'is empty':
          return { sql: notExistsClause, values: [fieldId] };
        case 'is not empty':
          return { sql: existsClause(''), values: [fieldId] };
        default:
          throw new BadRequestError(`Condition "${condition}" is not supported for custom string fields`);
      }
    }

    case 'number': {
      switch (condition) {
        case 'is': {
          const v = parseNumber(value);
          return { sql: existsClause(`AND lcfv.value::numeric = $${paramOffset + 1}::numeric`), values: [fieldId, v] };
        }
        case 'greater than': {
          const v = parseNumber(value);
          return { sql: existsClause(`AND lcfv.value::numeric > $${paramOffset + 1}::numeric`), values: [fieldId, v] };
        }
        case 'less than': {
          const v = parseNumber(value);
          return { sql: existsClause(`AND lcfv.value::numeric < $${paramOffset + 1}::numeric`), values: [fieldId, v] };
        }
        case 'is empty':
          return { sql: notExistsClause, values: [fieldId] };
        case 'is not empty':
          return { sql: existsClause(''), values: [fieldId] };
        default:
          throw new BadRequestError(`Condition "${condition}" is not supported for custom number fields`);
      }
    }

    case 'boolean': {
      if (condition !== 'is') {
        throw new BadRequestError(`Only "is" condition is supported for boolean custom fields`);
      }
      const v = parseBoolean(value);
      return { sql: existsClause(`AND LOWER(lcfv.value) = $${paramOffset + 1}`), values: [fieldId, v] };
    }

    case 'date': {
      switch (condition) {
        case 'before': {
          const d = parseDate(value);
          return { sql: existsClause(`AND lcfv.value::date < $${paramOffset + 1}::date`), values: [fieldId, d] };
        }
        case 'after': {
          const d = parseDate(value);
          return { sql: existsClause(`AND lcfv.value::date > $${paramOffset + 1}::date`), values: [fieldId, d] };
        }
        case 'is': {
          const d = parseDate(value);
          return { sql: existsClause(`AND lcfv.value::date = $${paramOffset + 1}::date`), values: [fieldId, d] };
        }
        case 'is empty':
          return { sql: notExistsClause, values: [fieldId] };
        case 'is not empty':
          return { sql: existsClause(''), values: [fieldId] };
        default:
          throw new BadRequestError(`Condition "${condition}" is not supported for custom date fields`);
      }
    }

    default:
      throw new BadRequestError(`Unsupported custom field type: ${fieldType}`);
  }
}

// dispatch to the right builder based on field type

function buildSingleFilterClause(filter: LeadFilter, paramOffset: number): SqlClause {
  const { fieldId, fieldType, condition } = filter;

  if (!isSystemField(fieldId)) {
    return buildCustomFieldClause(filter, paramOffset);
  }

  const column = SYSTEM_FIELD_MAP[fieldId];

  if (AGENT_FIELDS.has(fieldId)) {
    return buildAgentClause(column, condition, filter.value, filter.inputType, paramOffset);
  }

  if (DATE_FIELDS.has(fieldId)) {
    const nullable = fieldId === 'followUpDate';
    return buildDateClause(column, condition, filter.value, nullable, paramOffset);
  }

  if (fieldType !== 'string') {
    throw new BadRequestError(`Field "${fieldId}" expects fieldType "string", got "${fieldType}"`);
  }

  const numericOnlyOps = new Set(['greater than', 'less than', 'before', 'after']);
  if (numericOnlyOps.has(condition)) {
    throw new BadRequestError(`Condition "${condition}" is not supported for string field "${fieldId}"`);
  }

  const nullable = fieldId === 'email' || fieldId === 'assignedTo';
  return buildStringClause(column, condition, filter.value, nullable, paramOffset);
}

// public API

export interface LeadFilterClause {
  sql: string;
  values: unknown[];
}

export function buildLeadFilterClause(
  filters: LeadFilter[],
  logic: 'AND' | 'OR',
  paramStart: number,
): LeadFilterClause {
  if (filters.length === 0) {
    return { sql: '', values: [] };
  }

  const clauses: string[] = [];
  const allValues: unknown[] = [];
  let paramOffset = paramStart;

  for (const filter of filters) {
    const clause = buildSingleFilterClause(filter, paramOffset);
    clauses.push(`(${clause.sql})`);
    allValues.push(...clause.values);
    paramOffset += clause.values.length;
  }

  return {
    sql: clauses.join(` ${logic} `),
    values: allValues,
  };
}
