// app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product'; // Assumed to have the 'cost' field
import Order from '@/lib/models/orders'; // CONFIRMED: Mongoose Model for 'orders' collection

// --- 1. FRONTEND DATA INTERFACE DEFINITION ---
interface ReportData {
  summary: {
    totalRevenue: number;
    unitsSold: number;
    profitMargin: number; // 0 to 100
    activeCustomers: number;
    totalProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number; // Inventory value
  };
  monthlyTrends: Array<{
    month: string;
    revenue: number;
    profit: number;
  }>;
  topCategories: Array<{
    category: string;
    revenue: number;
    unitsSold: number;
    growth: number; 
  }>;
  stockAlerts: Array<{
    product: string;
    currentStock: number;
    threshold: number;
    status: 'low' | 'out';
  }>;
}

// Helper to determine the start date based on the 'period' filter
function getPeriodStartDate(period: string): Date {
    const now = new Date();
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    switch (period) {
        case 'this-month':
            startDate.setDate(1);
            break;
        case 'this-quarter':
            const currentMonth = now.getMonth();
            const startMonth = currentMonth - (currentMonth % 3);
            startDate.setMonth(startMonth, 1);
            break;
        case 'this-year':
            startDate.setMonth(0, 1);
            break;
        default: // Default to this-month
            startDate.setDate(1);
            break;
    }
    return startDate;
}


export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();
        
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'this-month';
        const category = searchParams.get('category') || 'all';

        const startDate = getPeriodStartDate(period);
        const today = new Date();

        // --- PHASE 1: INVENTORY METRICS (from Product Collection) ---
        
        const productMatchStage = category !== 'all' ? { category: category } : {};

        const inventorySummary = await Product.aggregate([
            { $match: productMatchStage },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    // IMPORTANT: Using 'price' for Total Value since 'cost' is missing from schema
                    totalValue: { $sum: { $multiply: ['$quantity', '$price'] } } 
                }
            }
        ]);
        
        const totalProducts = inventorySummary[0]?.totalProducts || 0;
        const totalValue = inventorySummary[0]?.totalValue || 0;

        // Low stock/Out of stock counts
        const lowStockItems = await Product.countDocuments({
             ...productMatchStage,
             $expr: { $and: [{ $lte: ['$quantity', '$lowStockThreshold'] }, { $gt: ['$quantity', 0] }] }
        });
        
        const outOfStockItems = await Product.countDocuments({ 
            ...productMatchStage,
            quantity: 0 
        });

        // Stock Alerts (Top 5 Low Stock Items)
        const stockAlerts = await Product.find({
            ...productMatchStage, // Apply category filter
            $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
        })
        .sort({ quantity: 1 })
        .limit(5)
        .select('name quantity lowStockThreshold')
        .lean()
        .then(alerts => alerts.map(p => ({
            product: p.name,
            currentStock: p.quantity,
            threshold: p.lowStockThreshold,
            status: p.quantity === 0 ? 'out' as 'out' : 'low' as 'low'
        })));


        // --- PHASE 2: SALES METRICS (from Order Collection using $facet) ---

        // Sale Match Stage - Filter by Date range
        const orderDateMatch = { createdAt: { $gte: startDate, $lte: today } };
        
        // **CRITICAL PROFIT NOTE:** Since the Product model lacks a 'cost' field,
        // we use a fixed 40% margin estimate for profit calculation.
        const ESTIMATED_PROFIT_MARGIN = 0.40;
        
        const salesData = await Order.aggregate([
            { $match: orderDateMatch },
            // Deconstruct the 'items' array into separate documents
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } }, 
            
            // Look up product info using the item's productId
            {
                $lookup: {
                    from: 'products', // The collection name for Product documents
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'productInfo',
                    pipeline: [
                        // Project only the necessary category (no cost field available)
                        { $project: { category: 1 } } 
                    ]
                }
            },
            { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: false } },

            // Filter by category after joining
            { $match: category !== 'all' ? { 'productInfo.category': category } : {} },
            
            // Calculate Estimated Profit per Item
            {
                $addFields: {
                    // Use OrderItem's 'total' field for item revenue
                    itemRevenue: '$items.total', 
                    // Calculate estimated profit (40% of item revenue)
                    itemProfit: { $multiply: ['$items.total', ESTIMATED_PROFIT_MARGIN] },
                    // Use OrderItem's 'quantity' for units sold
                    itemQuantity: '$items.quantity',
                    itemCategory: '$productInfo.category'
                }
            },
            
            {
                $facet: {
                    // 1. Overall Summary Metrics
                    overallSummary: [
                        {
                            $group: {
                                _id: null,
                                totalRevenue: { $sum: '$itemRevenue' },
                                totalProfit: { $sum: '$itemProfit' },
                                unitsSold: { $sum: '$itemQuantity' },
                                // Count unique customer IDs (if available in the root Order document)
                                activeCustomers: { $addToSet: '$customer.phone' } 
                            }
                        },
                        { $addFields: { activeCustomersCount: { $size: '$activeCustomers' } } }
                    ],
                    // 2. Monthly Trends (Revenue & Profit)
                    monthlyTrends: [
                        {
                            $group: {
                                _id: {
                                    $dateToString: { format: '%Y-%m', date: '$createdAt' } // Use Order's createdAt
                                },
                                revenue: { $sum: '$itemRevenue' },
                                profit: { $sum: '$itemProfit' }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    // 3. Top Categories (Revenue, Units Sold)
                    topCategories: [
                        {
                            $group: {
                                _id: '$itemCategory',
                                revenue: { $sum: '$itemRevenue' },
                                unitsSold: { $sum: '$itemQuantity' }
                            }
                        },
                        { $sort: { revenue: -1 } }
                    ],
                }
            }
        ]);
        
        // Extract Facet Results
        const overall = salesData[0]?.overallSummary[0] || {};
        const activeCustomerCount = overall.activeCustomersCount || 0;
        const categories = salesData[0]?.topCategories || [];

        // Calculate Profit Margin
        const totalProfitCalculated = overall.totalProfit || 0;
        const totalRevenueCalculated = overall.totalRevenue || 0;
        
        const profitMargin = totalRevenueCalculated > 0 
            ? (totalProfitCalculated / totalRevenueCalculated) * 100 
            : 0;

        // Format Monthly Trends and add Growth (Placeholder for simplicity)
        const formattedTrends = salesData[0]?.monthlyTrends.map((t: any) => {
            const date = new Date(t._id + '-01');
            return {
                month: date.toLocaleString('en-US', { month: 'short' }),
                revenue: t.revenue,
                profit: t.profit,
            };
        });

        // Format Top Categories and add Growth (Placeholder for simplicity)
        const formattedCategories = categories.map((c: any) => ({
            category: c._id,
            revenue: c.revenue,
            unitsSold: c.unitsSold,
            growth: Math.random() * 30 - 10, // Mocked growth rate (you can implement a real one later)
        }));


        // --- PHASE 3: CONSTRUCT FINAL REPORT DATA ---

        const reportData: ReportData = {
            summary: {
                totalRevenue: totalRevenueCalculated,
                unitsSold: overall.unitsSold || 0,
                profitMargin: profitMargin,
                activeCustomers: activeCustomerCount,
                totalProducts: totalProducts,
                lowStockItems: lowStockItems,
                outOfStockItems: outOfStockItems,
                totalValue: totalValue,
            },
            monthlyTrends: formattedTrends,
            topCategories: formattedCategories,
            stockAlerts: stockAlerts,
        };

        return NextResponse.json(reportData); 

    } catch (error) {
        console.error('Reports fetch error:', error);
        return NextResponse.json(
            { message: 'Internal server error', details: (error as Error).message },
            { status: 500 }
        );
    }
}
