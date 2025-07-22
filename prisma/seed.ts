import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create default shift types
  const shiftTypes = [
    {
      name: 'Morning',
      startTime: '07:00',
      endTime: '15:00',
      color: '#3232',
    },
    {
      name: 'Afternoon',
      startTime: '15:00',
      endTime: '23:00',
      color: '#1981',
    },
    {
      name: 'Full Day',
      startTime: '08:00',
      endTime: '17:00',
      color: '#F590',
    },
    {
      name: 'Delivery',
      startTime: '09:00',
      endTime: '18:00',
      color: '#EF4444',
    },
    {
      name: 'Kitchen',
      startTime: '06:00',
      endTime: '14:00',
      color: '#8B5CF6',
    },
  ]

  for (const shiftType of shiftTypes) {
    await prisma.shiftType.upsert({
      where: { name: shiftType.name },
      update: shiftType,
      create: shiftType
    })
  }

  console.log('✅ Shift types created')

  // Update existing staff to have proper access levels if they don't have them
  const staffToUpdate = await prisma.staff.findMany({
    where: {
      OR: [
        { accessLevel: null },
        { accessLevel: '' },
      ],
    },
  })

  for (const staff of staffToUpdate) {
    await prisma.staff.update({
      where: { id: staff.id },
      data: { accessLevel: staff.accessLevel }
    })
  }

  console.log('✅ Staff access levels updated')

  console.log('🎉 Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 