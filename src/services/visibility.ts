import { CurrentUser } from '../middleware/auth';
import { SqlClause } from './filters';

// agents only see leads assigned to them; owners/admins/managers see all
export function buildVisibilityClause(user: CurrentUser, paramStart: number): SqlClause {
  if (user.role === 'agent') {
    return {
      sql: `leads.assigned_to = $${paramStart}`,
      values: [user.userId],
    };
  }

  return { sql: '', values: [] };
}
