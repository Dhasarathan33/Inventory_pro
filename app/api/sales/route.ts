import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'

// POST: Record a new sale
export async function POST(request: NextRequest) {
  try {
    await connectDB()
    const saleData = await request.json()

    // Create and save the sale
    const sale = await Sale.create(saleData)

    // Decrease product stock after sale
    const product = await Product.findById(sale.productId)
    if (product) {
      product.stock = Math.max(product.stock - sale.quantity, 0)
      await product.save()
    }

    return NextResponse.json({ success: true, sale })
  } catch (error) {
    console.error('Error processing sale:', error)
    return NextResponse.json(
      { error: 'Failed to process sale' },
      { status: 500 }
    )
  }
}

// GET: Fetch all sales
export async function GET() {
  try {
    await connectDB()
    const sales = await Sale.find().populate('productId').sort({ createdAt: -1 })
    return NextResponse.json(sales)
  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    )
  }
}
