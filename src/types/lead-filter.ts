import { z } from 'zod';

// Filter field types

export const FilterFieldTypeSchema = z.enum(['string', 'number', 'date', 'boolean']);
export type FilterFieldType = z.infer<typeof FilterFieldTypeSchema>;

// Filter conditions

export const FilterConditionSchema = z.enum([
  'is',
  'is not',
  'contain',
  'does not contain',
  'starts with',
  'ends with',
  'before',
  'after',
  'greater than',
  'less than',
  'is empty',
  'is not empty',
]);
export type FilterCondition = z.infer<typeof FilterConditionSchema>;

// Single filter

export const LeadFilterSchema = z.object({
  fieldId: z.string().min(1, 'fieldId is required'),
  fieldType: FilterFieldTypeSchema,
  condition: FilterConditionSchema,
  value: z.string().optional(),
  inputType: z.string().optional(), // e.g. "text" | "select" | "multiselect"
});
export type LeadFilter = z.infer<typeof LeadFilterSchema>;

// Full query body

export const QueryLeadsBodySchema = z.object({
  q: z.string().optional(),
  logic: z.enum(['AND', 'OR']).optional().default('AND'),
  filters: z.array(LeadFilterSchema).optional().default([]),
});
export type QueryLeadsBody = z.infer<typeof QueryLeadsBodySchema>;

// Query params

export const QueryLeadsParamsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .refine((v) => Number.isInteger(v) && v >= 1, { message: 'page must be an integer ≥ 1' }),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 100, {
      message: 'limit must be an integer between 1 and 100',
    }),
  sortBy: z
    .enum(['createdAt', 'followUpDate'])
    .optional()
    .default('createdAt')
    .refine((v) => v === 'createdAt' || v === 'followUpDate', {
      message: 'sortBy must be "followUpDate" or "createdAt"',
    }),
  sortDirection: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc')
    .refine((v) => v === 'asc' || v === 'desc', {
      message: 'sortDirection must be "asc" or "desc"',
    }),
});
export type QueryLeadsParams = z.infer<typeof QueryLeadsParamsSchema>;

// System field IDs -> DB column mapping

export const SYSTEM_FIELD_MAP: Record<string, string> = {
  name:         'leads.name',
  phone:        'leads.phone',
  email:        'leads.email',
  assignedTo:   'leads.assigned_to',
  createdBy:    'leads.user_id',
  followUpDate: 'leads.follow_up_date',
  createdAt:    'leads.created_at',
  updatedAt:    'leads.updated_at',
};

export const AGENT_FIELDS = new Set(['assignedTo', 'createdBy']);
export const DATE_FIELDS  = new Set(['followUpDate', 'createdAt', 'updatedAt']);

export function isSystemField(fieldId: string): boolean {
  return fieldId in SYSTEM_FIELD_MAP;
}

// DB row types (raw SQL results)

export interface LeadRow {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  phone: string;
  country_code: string;
  e164: string;
  email: string | null;
  assigned_to: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValueRow {
  lead_id: string;
  field_id: string;
  label: string;
  value: string;
}

// Response types

export interface LeadResponse {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  phone: string;
  countryCode: string;
  e164: string;
  email: string | null;
  assignedTo: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  customFields: Array<{ fieldId: string; label: string; value: string }>;
}
