import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🚀 Starting comprehensive data initialization with Prisma...');
    
    // Step 1: Create sample staff
    console.log('👥 Step 1: Creating sample staff...');
    const sampleStaff = [
      {
        firstName: 'John',
        lastName: 'Smith',
        phone: '+64211234567',
        email: 'john@caterstation.co.nz',
        payRate: 25.50,
        accessLevel: 'staff',
        isDriver: true,
        isActive: true
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        phone: '+64219876543',
        email: 'sarah@caterstation.co.nz',
        payRate: 28.00,
        accessLevel: 'manager',
        isDriver: false,
        isActive: true
      },
      {
        firstName: 'Mike',
        lastName: 'Wilson',
        phone: '+64215556677',
        email: 'mike@caterstation.co.nz',
        payRate: 22.00,
        accessLevel: 'staff',
        isDriver: true,
        isActive: true
      }
    ];
    
    for (const staff of sampleStaff) {
      await prisma.staff.create({ data: staff });
    }
    console.log('✅ Sample staff created');
    
    // Step 2: Create sample suppliers
    console.log('🏢 Step 2: Creating sample suppliers...');
    const sampleSuppliers = [
      {
        name: 'Bidfood',
        contactName: 'Jane Cooper',
        contactNumber: '+6491234567',
        contactEmail: 'orders@bidfood.co.nz'
      },
      {
        name: 'Gilmours',
        contactName: 'Bob Wilson',
        contactNumber: '+6492345678',
        contactEmail: 'orders@gilmours.co.nz'
      },
      {
        name: 'Local Butcher',
        contactName: 'Tom Brown',
        contactNumber: '+6493456789',
        contactEmail: 'tom@localbutcher.co.nz'
      }
    ];
    
    for (const supplier of sampleSuppliers) {
      await prisma.supplier.create({ data: supplier });
    }
    console.log('✅ Sample suppliers created');
    
    // Step 3: Create sample components
    console.log('🍽️ Step 3: Creating sample components...');
    const sampleComponents = [
      {
        name: 'Chicken Breast',
        description: 'Fresh chicken breast for tacos',
        ingredients: [
          { name: 'Chicken Breast', quantity: 1, unit: 'kg', cost: 12.50 },
          { name: 'Marinade', quantity: 1, unit: 'batch', cost: 2.00 }
        ],
        totalCost: 14.50,
        hasGluten: false,
        hasDairy: false,
        hasSoy: false,
        hasOnionGarlic: true,
        hasSesame: false,
        hasNuts: false,
        hasEgg: false,
        isVegetarian: false,
        isVegan: false,
        isHalal: true
      },
      {
        name: 'Beef Mince',
        description: 'Premium beef mince for tacos',
        ingredients: [
          { name: 'Beef Mince', quantity: 1, unit: 'kg', cost: 18.00 },
          { name: 'Taco Seasoning', quantity: 1, unit: 'packet', cost: 1.50 }
        ],
        totalCost: 19.50,
        hasGluten: false,
        hasDairy: false,
        hasSoy: false,
        hasOnionGarlic: true,
        hasSesame: false,
        hasNuts: false,
        hasEgg: false,
        isVegetarian: false,
        isVegan: false,
        isHalal: false
      }
    ];
    
    for (const component of sampleComponents) {
      await prisma.component.create({ data: component });
    }
    console.log('✅ Sample components created');
    
    // Step 4: Create sample shift types
    console.log('⏰ Step 4: Creating sample shift types...');
    const sampleShiftTypes = [
      {
        name: 'Morning Prep',
        startTime: '06:00',
        endTime: '14:00',
        color: '#3B82F6',
        isActive: true
      },
      {
        name: 'Afternoon Service',
        startTime: '14:00',
        endTime: '22:00',
        color: '#10B981',
        isActive: true
      },
      {
        name: 'Delivery',
        startTime: '10:00',
        endTime: '18:00',
        color: '#F59E0B',
        isActive: true
      }
    ];
    
    for (const shiftType of sampleShiftTypes) {
      await prisma.shiftType.create({ data: shiftType });
    }
    console.log('✅ Sample shift types created');
    
    // Step 5: Create sample product rules
    console.log('⚙️ Step 5: Creating sample product rules...');
    const sampleRules = [
      {
        name: 'Korean Taco Kit Rule',
        description: 'Automatically sets meat options for Korean Taco Kits',
        isActive: true,
        priority: 1,
        matchPattern: 'Korean Taco Kit',
        matchType: 'contains',
        setDisplayName: 'Korean Taco Kit',
        setMeat1: 'Korean Fried Tofu',
        setMeat2: 'Pulled Beef',
        setTimer1: 15,
        setTimer2: 20,
        setOption1: 'Spicy',
        setOption2: 'Mild',
        setServeware: true,
        setTotalCost: 25.00
      }
    ];
    
    for (const rule of sampleRules) {
      await prisma.productRule.create({ data: rule });
    }
    console.log('✅ Sample product rules created');
    
    // Step 6: Create sample supplier products
    console.log('🏪 Step 6: Creating sample supplier products...');
    
    // Gilmours products
    const sampleGilmoursProducts = [
      {
        sku: 'GLM-CHK-001',
        brand: 'Gilmours',
        description: 'Fresh Chicken Breast',
        packSize: '2kg',
        uom: 'kg',
        price: 12.50,
        quantity: 100
      }
    ];
    
    for (const product of sampleGilmoursProducts) {
      await prisma.gilmoursProduct.create({ data: product });
    }
    
    // Bidfood products
    const sampleBidfoodProducts = [
      {
        productCode: 'BDF-BEEF-001',
        brand: 'Bidfood',
        description: 'Premium Beef Mince',
        packSize: '1kg',
        ctnQty: '10',
        uom: 'kg',
        qty: 50,
        lastPricePaid: 18.00,
        totalExGST: 16.52,
        contains: 'Beef mince only'
      }
    ];
    
    for (const product of sampleBidfoodProducts) {
      await prisma.bidfoodProduct.create({ data: product });
    }
    
    // Other products
    const sampleOtherProducts = [
      {
        name: 'Fresh Herbs',
        supplier: 'Local Market',
        description: 'Fresh cilantro and mint',
        cost: 5.00
      }
    ];
    
    for (const product of sampleOtherProducts) {
      await prisma.otherProduct.create({ data: product });
    }
    
    console.log('✅ Sample supplier products created');
    
    console.log('🎉 Comprehensive data initialization completed with Prisma!');
    
    return NextResponse.json({
      success: true,
      message: 'Comprehensive data initialization completed successfully with Prisma',
      summary: {
        staff: sampleStaff.length,
        suppliers: sampleSuppliers.length,
        components: sampleComponents.length,
        shiftTypes: sampleShiftTypes.length,
        productRules: sampleRules.length,
        gilmoursProducts: sampleGilmoursProducts.length,
        bidfoodProducts: sampleBidfoodProducts.length,
        otherProducts: sampleOtherProducts.length
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ Error during comprehensive data initialization:', error);
    return NextResponse.json({
      success: false,
      message: 'Error during comprehensive data initialization',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 