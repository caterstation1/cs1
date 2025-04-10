import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { JsonValue } from '@prisma/client/runtime/library'
import { z } from 'zod'
import Papa from 'papaparse'

// Define types for our products based on the actual Prisma schema
type GilmoursProduct = {
  id: string
  sku: string
  brand: string
  description: string
  packSize: string
  uom: string
  price: number
  quantity: number
  createdAt: Date
  updatedAt: Date
}

type BidfoodProduct = {
  id: string
  productCode: string
  brand: string
  description: string
  packSize: string
  ctnQty: string
  uom: string
  qty: number
  lastPricePaid: number
  totalExGST: number
  contains: string
  createdAt: Date
  updatedAt: Date
}

type OtherProduct = {
  id: string
  name: string
  supplier: string
  description: string
  cost: number
  createdAt: Date
  updatedAt: Date
}

type Component = {
  id: string
  name: string
  description: string
  ingredients: JsonValue
  totalCost: number
  hasGluten: boolean
  hasDairy: boolean
  hasSoy: boolean
  hasOnionGarlic: boolean
  hasSesame: boolean
  hasNuts: boolean
  hasEgg: boolean
  isVegetarian: boolean
  isVegan: boolean
  isHalal: boolean
  createdAt: Date
  updatedAt: Date
}

// Define the ingredient schema
const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number(),
  cost: z.number(),
  source: z.enum(['Gilmours', 'Bidfood', 'Other', 'Components', 'Products']),
});

// Define the product schema
const productSchema = z.object({
  name: z.string(),
  description: z.string(),
  addon: z.string().optional(),
  handle: z.string().optional(),
  meat1: z.string().optional(),
  meat2: z.string().optional(),
  option1: z.string().optional(),
  option2: z.string().optional(),
  serveware: z.string().optional(),
  timerA: z.number().optional(),
  timerB: z.number().optional(),
  skuSearch: z.string().optional(),
  variantSku: z.string().optional(),
  ingredients: z.array(ingredientSchema),
  sellingPrice: z.number().optional(),
});

// Define the CSV product schema
const csvProductSchema = z.object({
  addon: z.string().optional(),
  name: z.string(),
  listOfIngredients: z.string().optional(),
  meat1: z.string().optional(),
  meat2: z.string().optional(),
  option1: z.string().optional(),
  option2: z.string().optional(),
  serveware: z.string().optional(),
  skuSearch: z.string().optional(),
  variantSku: z.string().optional(),
});

// Calculate total cost from ingredients
const calculateTotalCost = (ingredients: any[]) => {
  if (!ingredients || !Array.isArray(ingredients)) {
    return 0;
  }
  
  return ingredients.reduce((total, ingredient) => {
    if (!ingredient || typeof ingredient.quantity !== 'number' || typeof ingredient.cost !== 'number') {
      return total;
    }
    return total + (ingredient.quantity * ingredient.cost);
  }, 0);
};

export async function GET() {
  try {
    console.log('Fetching all products...')
    
    // Fetch actual products from the Product model
    const products = await prisma.product.findMany({
      orderBy: {
        name: 'asc',
      },
    }).catch(() => []);

    console.log(`Found ${products.length} Products`);

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate the request body
    const validatedData = productSchema.parse(body);
    
    // Calculate total cost
    const totalCost = calculateTotalCost(validatedData.ingredients);
    
    // Check if this is an update (has id) or a new product
    if (body.id) {
      // Update existing product
      const product = await prisma.product.update({
        where: { id: body.id },
        data: {
          ...validatedData,
          totalCost,
          realizedMargin: validatedData.sellingPrice 
            ? ((validatedData.sellingPrice - totalCost) / validatedData.sellingPrice) * 100
            : null,
        },
      }).catch(error => {
        console.error('Error updating product in database:', error);
        throw new Error('Failed to update product in database');
      });
      
      return NextResponse.json(product);
    } else {
      // Create new product
      const product = await prisma.product.create({
        data: {
          ...validatedData,
          totalCost,
          realizedMargin: validatedData.sellingPrice 
            ? ((validatedData.sellingPrice - totalCost) / validatedData.sellingPrice) * 100
            : null,
        },
      }).catch(error => {
        console.error('Error creating product in database:', error);
        throw new Error('Failed to create product in database');
      });
      
      return NextResponse.json(product);
    }
  } catch (error) {
    console.error('Error creating/updating product:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid product data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create/update product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    const text = await file.text();
    const { data, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (errors.length > 0) {
      console.error('CSV parsing errors:', errors);
      return NextResponse.json(
        { error: 'Failed to parse CSV file', details: errors },
        { status: 400 }
      );
    }
    
    const validatedProducts = [];
    const failedProducts = [];
    
    for (const row of data) {
      try {
        const validatedData = csvProductSchema.parse(row);
        
        // Create the product
        const product = await prisma.product.create({
          data: {
            name: validatedData.name,
            description: validatedData.name, // Use name as description if not provided
            addon: validatedData.addon || null,
            meat1: validatedData.meat1 || null,
            meat2: validatedData.meat2 || null,
            option1: validatedData.option1 || null,
            option2: validatedData.option2 || null,
            serveware: validatedData.serveware || null,
            skuSearch: validatedData.skuSearch || null,
            variantSku: validatedData.variantSku || null,
            ingredients: [], // Empty array for now
            totalCost: 0, // Default to 0
          },
        });
        
        validatedProducts.push(product);
      } catch (error) {
        console.error('Error processing row:', row, error);
        failedProducts.push({
          row,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      imported: validatedProducts.length,
      failed: failedProducts.length,
      failedProducts,
    });
  } catch (error) {
    console.error('Error importing products:', error);
    return NextResponse.json(
      { error: 'Failed to import products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 