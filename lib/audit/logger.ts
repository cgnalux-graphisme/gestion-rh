import { createAdminClient } from '@/lib/supabase/server'
import { AuditCategory } from '@/types/database'

type AuditEntry = {
  targetUserId: string
  actorUserId: string
  action: string
  category: AuditCategory
  description: string
  metadata?: Record<string, unknown>
  commentaire?: string | null
}

export async function logAudit(entry: AuditEntry) {
  const admin = createAdminClient()
  await admin.from('audit_log').insert({
    target_user_id: entry.targetUserId,
    actor_user_id: entry.actorUserId,
    action: entry.action,
    category: entry.category,
    description: entry.description,
    metadata: entry.metadata ?? {},
    commentaire: entry.commentaire ?? null,
  })
}
