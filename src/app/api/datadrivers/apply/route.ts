import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      fullName,
      phone,
      email,
      vehicleMake,
      vehicleModel,
      vehiclePlate,
      vehiclePhotoUrl,
      licencePhotoUrl,
      bankAccount,
      baseSuburb,
      notes,
    } = body || {}

    if (!fullName || !phone) {
      return NextResponse.json({ error: 'fullName and phone are required' }, { status: 400 })
    }

    // Upsert DataDriver by phone (unique)
    const driver = await prisma.dataDriver.upsert({
      where: { phone },
      create: {
        fullName,
        phone,
        email: email || null,
        status: 'pending',
        availability: false,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehiclePlate: vehiclePlate || null,
        vehiclePhotoUrl: vehiclePhotoUrl || null,
        licencePhotoUrl: licencePhotoUrl || null,
        bankAccountEnc: bankAccount || null, // TODO: encrypt at rest
        baseSuburb: baseSuburb || null,
        internalNotes: notes || null,
      },
      update: {
        fullName,
        email: email || null,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehiclePlate: vehiclePlate || null,
        vehiclePhotoUrl: vehiclePhotoUrl || null,
        licencePhotoUrl: licencePhotoUrl || null,
        bankAccountEnc: bankAccount || null,
        baseSuburb: baseSuburb || null,
        internalNotes: notes || null,
        status: 'pending',
        availability: false,
      },
      select: { id: true, fullName: true, phone: true, status: true },
    })

    // Create an application record (duplicates allowed; latest wins operationally)
    await prisma.dataDriverApplication.create({
      data: { driverId: driver.id, decision: 'pending', adminNotes: notes || null },
    })

    return NextResponse.json({ ok: true, driver })
  } catch (e) {
    console.error('apply error', e)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

