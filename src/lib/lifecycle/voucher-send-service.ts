import { prisma } from '@/lib/prisma'
import { addDaysNZ, formatNZYMD } from '@/lib/date-utils'
import { ensureLifecycleCommsSettings, normalizeLifecycleSettings } from '@/lib/lifecycle/lifecycle-comms-service'
import { upsertRewardCatalogItem, listRewardCatalog } from '@/lib/lifecycle/reward-catalog-service'
import { issueReward } from '@/lib/lifecycle/reward-issue-service'
import {
  generateVoucherCode,
  getVoucherTemplate,
  parseVoucherTemplates,
  resolveVoucherExpiryDays,
  type VoucherTemplate,
} from '@/lib/lifecycle/voucher-templates'
import { provisionShopifyVoucherForCustomer } from '@/lib/shopify-discount-service'

type EnsureVoucherResult = {
  rewardIssueId: string | null
  rewardCode: string | null
  rewardExpiryDate: string | null
  rewardName: string | null
  shopifyDiscountNodeId: string | null
  voucherTemplate: VoucherTemplate | null
}

async function ensureVoucherRewardCatalog(template: VoucherTemplate) {
  const rows = await listRewardCatalog()
  const existing = rows.find(
    (row: any) =>
      row.rewardType === 'voucher' &&
      String(row.codePrefix || row.defaultCode || '')
        .replace(/\s+/g, '')
        .toUpperCase() === template.codePrefix.toUpperCase()
  )
  if (existing) return existing

  return upsertRewardCatalogItem({
    rewardName: template.label,
    rewardType: 'voucher',
    defaultCode: template.codePrefix,
    codePrefix: template.codePrefix,
    perceivedValue: 0,
    expiryDays: resolveVoucherExpiryDays(template),
    enabled: true,
    eligibleEmailTypes: ['SECOND_ORDER_INCENTIVE', 'STRATEGIC_SECOND_ORDER_VOUCHER'],
  })
}

export async function ensureVoucherForSend(input: {
  companyId: string
  contactId?: string | null
  customerEmail?: string | null
  shopifyCustomerId?: string | null
  companyName?: string | null
  voucherTemplateId?: string | null
  existingRewardIssueId?: string | null
  syncShopify: boolean
}): Promise<EnsureVoucherResult> {
  const settings = normalizeLifecycleSettings(await ensureLifecycleCommsSettings())
  const templates = parseVoucherTemplates(settings.rewardRuleConfig?.voucherTemplates)
  const template = getVoucherTemplate(templates, input.voucherTemplateId)
  if (!template) {
    return {
      rewardIssueId: input.existingRewardIssueId || null,
      rewardCode: null,
      rewardExpiryDate: null,
      rewardName: null,
      shopifyDiscountNodeId: null,
      voucherTemplate: null,
    }
  }

  if (input.existingRewardIssueId) {
    const existing = await (prisma as any).rewardIssue.findUnique({
      where: { rewardIssueId: input.existingRewardIssueId },
      include: { rewardCatalog: true },
    })
    if (existing) {
      const notes = String(existing.notes || '')
      let shopifyDiscountNodeId: string | null = null
      if (input.syncShopify && !notes.includes('shopifyDiscountNodeId=')) {
        const expiryDate = existing.expiryDate ? new Date(existing.expiryDate) : new Date()
        const shopify = await provisionShopifyVoucherForCustomer({
          template,
          code: existing.code,
          email: input.customerEmail,
          shopifyCustomerId: input.shopifyCustomerId,
          endsAt: expiryDate,
          title: `${template.label}${input.companyName ? ` — ${input.companyName}` : ''}`,
        })
        shopifyDiscountNodeId = shopify.discountNodeId
        await (prisma as any).rewardIssue.update({
          where: { rewardIssueId: existing.rewardIssueId },
          data: {
            notes: `${notes ? `${notes}; ` : ''}shopifyDiscountNodeId=${shopify.discountNodeId}; shopifySourceNodeId=${shopify.sourceNodeId}; customerGid=${shopify.customerGid}`,
          },
        })
      }

      return {
        rewardIssueId: existing.rewardIssueId,
        rewardCode: existing.code,
        rewardExpiryDate: existing.expiryDate
          ? new Date(existing.expiryDate).toISOString().slice(0, 10)
          : null,
        rewardName: existing.rewardCatalog?.rewardName || template.label,
        shopifyDiscountNodeId,
        voucherTemplate: template,
      }
    }
  }

  const code = generateVoucherCode(template.codePrefix)
  const issuedDate = new Date()
  const expiryDays = resolveVoucherExpiryDays(template)
  const expiryYmd = addDaysNZ(formatNZYMD(issuedDate), expiryDays)
  const expiryDate = new Date(`${expiryYmd}T23:59:59.999Z`)

  let shopifyDiscountNodeId: string | null = null
  let shopifyNotes = ''
  if (input.syncShopify) {
    const shopify = await provisionShopifyVoucherForCustomer({
      template,
      code,
      email: input.customerEmail,
      shopifyCustomerId: input.shopifyCustomerId,
      endsAt: expiryDate,
      title: `${template.label}${input.companyName ? ` — ${input.companyName}` : ''}`,
    })
    shopifyDiscountNodeId = shopify.discountNodeId
        shopifyNotes = `shopifyDiscountNodeId=${shopify.discountNodeId}; shopifySourceNodeId=${shopify.sourceNodeId}; customerGid=${shopify.customerGid}`
  }

  const rewardCatalog = await ensureVoucherRewardCatalog(template)
  const rewardIssue = await issueReward({
    companyId: input.companyId,
    contactId: input.contactId || null,
    rewardCatalogId: rewardCatalog.rewardCatalogId,
    sourceType: 'manual',
    sourceRuleKey: `voucher_template:${template.voucherTemplateId}`,
    notes: shopifyNotes || `voucherTemplateId=${template.voucherTemplateId}`,
    status: 'issued',
    code,
    expiryDate,
  })

  return {
    rewardIssueId: rewardIssue.rewardIssueId,
    rewardCode: rewardIssue.code,
    rewardExpiryDate: expiryYmd,
    rewardName: template.label,
    shopifyDiscountNodeId,
    voucherTemplate: template,
  }
}
