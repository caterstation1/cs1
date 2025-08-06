import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('📋 Fetching product rules from PostgreSQL...');
    
    const rules = await prisma.productRule.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`✅ Successfully fetched ${rules.length} product rules`);
    return NextResponse.json(rules);
  } catch (error) {
    console.error('❌ Error fetching product rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('📝 Creating product rule with data:', JSON.stringify(body, null, 2));
    console.log('🧀 setIngredients value:', body.setIngredients);
    console.log('🧀 setIngredients type:', typeof body.setIngredients);
    console.log('🧀 setIngredients is array:', Array.isArray(body.setIngredients));
    
    const rule = await prisma.productRule.create({
      data: {
        name: body.name,
        description: body.description,
        isActive: body.isActive !== false,
        priority: body.priority || 0,
        matchPattern: body.matchPattern,
        matchType: body.matchType || 'contains',
        setDisplayName: body.setDisplayName,
        setMeat1: body.setMeat1,
        setMeat2: body.setMeat2,
        setTimer1: body.setTimer1,
        setTimer2: body.setTimer2,
        setOption1: body.setOption1,
        setOption2: body.setOption2,
        setServeware: body.setServeware,
        setIngredients: body.setIngredients,
        setTotalCost: body.setTotalCost
      }
    });
    
    console.log(`✅ Created product rule: ${rule.name}`);
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating product rule:', error);
    return NextResponse.json(
      { error: 'Failed to create product rule' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    const rule = await prisma.productRule.update({
      where: { id: body.id },
      data: {
        name: body.name,
        description: body.description,
        isActive: body.isActive,
        priority: body.priority,
        matchPattern: body.matchPattern,
        matchType: body.matchType,
        setDisplayName: body.setDisplayName,
        setMeat1: body.setMeat1,
        setMeat2: body.setMeat2,
        setTimer1: body.setTimer1,
        setTimer2: body.setTimer2,
        setOption1: body.setOption1,
        setOption2: body.setOption2,
        setServeware: body.setServeware,
        setIngredients: body.setIngredients,
        setTotalCost: body.setTotalCost
      }
    });
    
    console.log(`✅ Updated product rule: ${rule.name}`);
    return NextResponse.json(rule);
  } catch (error) {
    console.error('❌ Error updating product rule:', error);
    return NextResponse.json(
      { error: 'Failed to update product rule' },
      { status: 500 }
    );
  }
} 