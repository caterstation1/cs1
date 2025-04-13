import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Get today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Get tomorrow's date
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // Fetch orders for today and tomorrow
    const orders = await prisma.shopifyOrder.findMany({
      where: {
        deliveryDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        customer: true,
        lineItems: true,
      },
      orderBy: {
        deliveryTime: "asc",
      },
    })
    
    // Transform the data to match the expected format
    const transformedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim(),
      deliveryDate: order.deliveryDate.toISOString(),
      deliveryTime: order.deliveryTime || "Not specified",
      status: order.status,
      items: order.lineItems.map(item => ({
        id: item.id,
        name: item.productTitle,
        quantity: item.quantity,
        price: item.price,
        modifications: item.modifications ? JSON.parse(item.modifications as string) : [],
      })),
      totalPrice: order.totalPrice,
    }))
    
    return NextResponse.json(transformedOrders)
  } catch (error) {
    console.error("Error fetching realtime orders:", error)
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    )
  }
} 