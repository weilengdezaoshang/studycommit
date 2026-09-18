import {
  canCompensateClaim,
  canManageCampaignDraft,
  canManageRoles,
  canPublishCampaign,
  canPublishPrice,
  canReadAdmin,
  canManageProviderConfig,
  canUpdateServiceSwitch,
  type AdminRole,
} from '@/auth/capabilities'

export default function access(
  initialState: { session?: { role?: AdminRole } | null } | undefined,
) {
  const role = initialState?.session?.role
  return {
    canView: canReadAdmin(role),
    canManageDraft: canManageCampaignDraft(role),
    canPublish: canPublishCampaign(role),
    canCompensate: canCompensateClaim(role),
    canPublishPrice: canPublishPrice(role),
    canUpdateSwitch: canUpdateServiceSwitch(role),
    canManageProvider: canManageProviderConfig(role),
    canManageRoles: canManageRoles(role),
  }
}
