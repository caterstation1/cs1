import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Fetch products from different sources
    const [gilmoursProducts, bidfoodProducts, otherProducts, components] = await Promise.all([
      prisma.gilmoursProduct.findMany({
        select: {
          id: true,
          description: true,
          quantity: true,
          uom: true,
        },
      }),
      prisma.bidfoodProduct.findMany({
        select: {
          id: true,
          description: true,
          qty: true,
          uom: true,
        },
      }),
      prisma.otherProduct.findMany({
        select: {
          id: true,
          name: true,
          description: true,
        },
      }),
      prisma.component.findMany({
        select: {
          id: true,
          name: true,
          description: true,
        },
      }),
    ])
    
    // Transform the data to match the expected format
    const stockItems = [
      ...gilmoursProducts.map(product => ({
        id: product.id,
        name: product.description,
        quantity: product.quantity,
        unit: product.uom,
        lowStock: product.quantity < 10, // Example threshold
      })),
      ...bidfoodProducts.map(product => ({
        id: product.id,
        name: product.description,
        quantity: product.qty,
        unit: product.uom,
        lowStock: product.qty < 5, // Example threshold
      })),
      ...otherProducts.map(product => ({
        id: product.id,
        name: product.name || product.description,
        quantity: 1, // Default value
        unit: "unit",
        lowStock: false,
      })),
      ...components.map(component => ({
        id: component.id,
        name: component.name,
        quantity: 1, // Default value
        unit: "unit",
        lowStock: false,
      })),
    ]
    
    return NextResponse.json(stockItems)
  } catch (error) {
    console.error("Error fetching stock items:", error)
    return NextResponse.json(
      { error: "Failed to fetch stock items" },
      { status: 500 }
    )
  }
} 