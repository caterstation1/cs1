import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    SHOPIFY_SHOP_URL: process.env.SHOPIFY_SHOP_URL ? '***' : 'missing',
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN ? '***' : 'missing',
    DATABASE_URL: process.env.DATABASE_URL ? '***' : 'missing'
  };

  return NextResponse.json(envVars);
} 