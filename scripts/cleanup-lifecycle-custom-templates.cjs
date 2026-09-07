// One-off cleanup: remove lifecycle custom email templates whose names do NOT
// start with "_" (agent-built samples), keeping user-authored templates.
// Usage:
//   node scripts/cleanup-lifecycle-custom-templates.cjs           (dry run)
//   node scripts/cleanup-lifecycle-custom-templates.cjs --apply   (persist)
require('dotenv').config()
const { scriptPrismaOptions } = require('./lib/script-prisma-url.cjs')
const { PrismaClient } = require('../src/generated/prisma')

const APPLY = process.argv.includes('--apply')

async function main() {
  const prisma = new PrismaClient(scriptPrismaOptions(2))
  try {
    const settings = await prisma.lifecycleCommsSetting.findUnique({
      where: { key: 'LIFECYCLE_COMMS' },
    })
    if (!settings) {
      console.log('No LIFECYCLE_COMMS settings row found.')
      return
    }
    const config = settings.rewardRuleConfig || {}
    const templates = Array.isArray(config.customTemplates) ? config.customTemplates : []
    console.log(`Found ${templates.length} custom templates:`)
    const keep = []
    const remove = []
    for (const t of templates) {
      const name = String(t?.templateName || '').trim()
      if (name.startsWith('_')) keep.push(t)
      else remove.push(t)
      console.log(`  ${name.startsWith('_') ? 'KEEP  ' : 'DELETE'}  ${name || '(unnamed)'} [${t?.templateId}]`)
    }
    console.log(`\nKeeping ${keep.length}, deleting ${remove.length}.`)
    if (!APPLY) {
      console.log('Dry run only. Re-run with --apply to persist.')
      return
    }
    await prisma.lifecycleCommsSetting.update({
      where: { key: 'LIFECYCLE_COMMS' },
      data: { rewardRuleConfig: { ...config, customTemplates: keep } },
    })
    console.log('Applied. Deleted templates removed from settings.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
