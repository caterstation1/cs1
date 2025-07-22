import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get the rule details
    const rule = await prisma.productRule.findUnique({
      where: { id }
    })

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Find all products that match this rule's pattern
    const matchingProducts = await prisma.productWithCustomData.findMany({
      where: {
        OR: [
          { shopifyName: { contains: rule.matchPattern, mode: 'insensitive' } },
          { shopifyTitle: { contains: rule.matchPattern, mode: 'insensitive' } }
        ]
      }
    })

    let updatedCount = 0
    let errors = 0

    // For each matching product, revert the changes made by this rule
    for (const product of matchingProducts) {
      try {
        const updateData: any = {}

        // Revert each field that this rule set
        if (rule.setDisplayName !== null && rule.setDisplayName !== undefined) {
          updateData.displayName = null
        }
        if (rule.setMeat1 !== null && rule.setMeat1 !== undefined) {
          updateData.meat1 = null
        }
        if (rule.setMeat2 !== null && rule.setMeat2 !== undefined) {
          updateData.meat2 = null
        }
        if (rule.setTimer1 !== null && rule.setTimer1 !== undefined) {
          updateData.timer1 = null
        }
        if (rule.setTimer2 !== null && rule.setTimer2 !== undefined) {
          updateData.timer2 = null
        }
        if (rule.setOption1 !== null && rule.setOption1 !== undefined) {
          updateData.option1 = null
        }
        if (rule.setOption2 !== null && rule.setOption2 !== undefined) {
          updateData.option2 = null
        }
        if (rule.setServeware !== null && rule.setServeware !== undefined) {
          updateData.serveware = false
        }

        // Only update if there are fields to revert
        if (Object.keys(updateData).length > 0) {
          await prisma.productWithCustomData.update({
            where: { id: product.id },
            data: updateData
          })
          updatedCount++
        }
      } catch (error) {
        console.error(`Error reverting product ${product.id}:`, error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reversed rule changes for ${updatedCount} products`,
      result: {
        updated: updatedCount,
        errors,
        totalMatching: matchingProducts.length
      }
    })
  } catch (error) {
    console.error('Error reversing rule:', error)
    return NextResponse.json(
      { error: 'Failed to reverse rule changes' },
      { status: 500 }
    )
  }
} 