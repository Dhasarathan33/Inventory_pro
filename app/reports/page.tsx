'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  ShoppingCart, 
  BarChart3, 
  Download, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart, 
  BarChart, 
  Activity, 
  FileText, 
  Database, 
  RefreshCw,
  Clock
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';

// Register all Chart.js components once
Chart.register(...registerables);

// --- 1. TYPE DEFINITIONS (Simplified for clarity) ---
// In a real TSX file, these should be moved to a types file
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
    growth: number; // Percentage change
  }>;
  stockAlerts: Array<{
    product: string;
    currentStock: number;
    threshold: number;
    status: 'low' | 'out';
  }>;
}


// --- 2. REAL API HANDLER (Replaced Mock Data with actual fetch call) ---
const fetchReportData = async (period = 'this-month', category = 'all'): Promise<ReportData> => {
    // Construct API URL with query parameters
    const apiUrl = `/api/reports?period=${period}&category=${category}`;
    
    // Use exponential backoff for robust fetching
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        try {
            response = await fetch(apiUrl);
            
            if (!response.ok) {
                // If response is not 2xx, throw to trigger catch/retry
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data: ReportData = await response.json();
            return data;
            
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                console.error(`Failed to fetch report data after ${maxAttempts} attempts.`, error);
                throw error; // Re-throw the error to be caught by loadData
            }
            // Exponential backoff delay (1s, 2s, 4s)
            const delay = Math.pow(2, attempts - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    // Should be unreachable, but throw an error if it somehow gets here
    throw new Error("Exceeded max fetch attempts.");
};

// --- 3. HELPER COMPONENTS ---

function MetricCard({ title, value, change, icon, bgColor, description }) {
  const isPositive = change >= 0;
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 hover:shadow-lg transition-all transform hover:scale-[1.01]">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 ${bgColor} rounded-lg`}>
          {icon}
        </div>
        <p className={`text-xs font-medium flex items-center ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {Math.abs(change).toFixed(1)}%
        </p>
      </div>
      <div>
        {/* Use toLocaleString for number formatting */}
        <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  );
}

// --- 4. MAIN REPORTS COMPONENT ---

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('this-month');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeChart, setActiveChart] = useState('revenue');
  const [dataTimestamp, setDataTimestamp] = useState('');
  
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  // Function to fetch and update data
  const loadData = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      // THIS IS WHERE THE REAL API CALL IS MADE
      const data = await fetchReportData(selectedPeriod, selectedCategory); 
      setReportData(data);
      setDataTimestamp(new Date().toLocaleString());
    } catch (error) {
      console.error("Failed to fetch report data:", error);
      setReportData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod, selectedCategory]);

  // Initial data load and dependency-based re-fetch
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Chart rendering logic
  useEffect(() => {
    if (!reportData || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const isRevenue = activeChart === 'revenue';
    
    const chartData = {
      labels: reportData.monthlyTrends.map(t => t.month),
      datasets: [
        {
          label: isRevenue ? 'Revenue' : 'Profit',
          data: isRevenue 
            ? reportData.monthlyTrends.map(t => t.revenue)
            : reportData.monthlyTrends.map(t => t.profit),
          backgroundColor: isRevenue 
            ? 'rgba(59, 130, 246, 0.1)'
            : 'rgba(16, 185, 129, 0.1)',
          borderColor: isRevenue 
            ? 'rgb(59, 130, 246)'
            : 'rgb(16, 185, 129)',
          pointBackgroundColor: isRevenue ? 'rgb(59, 130, 246)' : 'rgb(16, 185, 129)',
          borderWidth: 3,
          fill: 'origin',
          tension: 0.4
        }
      ]
    };

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  // Format tooltip currency
                  label += '$' + context.parsed.y.toFixed(2).toLocaleString();
                }
                return label;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              callback: function(value) {
                // Format Y-axis currency to $XXk
                return '$' + (Number(value) / 1000).toFixed(0) + 'k';
              }
            }
          },
          x: {
             grid: {
              display: false
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [reportData, activeChart]);

  // Simplified List of All Categories for the filter dropdown
  const allCategories = reportData?.topCategories.map(c => c.category) || [];
  if (!allCategories.includes('all') && reportData) allCategories.unshift('all');


  // --- Render Functions ---
  
  if (loading && !reportData) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading comprehensive report data...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center p-6 bg-white border border-red-200 rounded-xl shadow-md">
          <Database className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-700 mb-4 font-medium">Could not load report data.</p>
          <button 
            onClick={() => loadData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Retry Loading Data
          </button>
        </div>
      </div>
    );
  }

  const S = reportData.summary; // Alias for summary for cleaner JSX
  
  // Helper to format currency values with comma separators
  const formatCurrency = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });


  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen">
      
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Inventory & Sales Dashboard</h1>
          <p className="text-slate-600">High-level real-time business analytics for management.</p>
          <p className="text-xs text-slate-400 mt-2">
            Data aggregated: {dataTimestamp} 
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Filters */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm text-sm min-w-[140px]"
          >
            <option value="all">All Categories</option>
            {allCategories.filter(c => c !== 'all').map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm text-sm min-w-[140px]"
          >
            <option value="this-month">This Month</option>
            <option value="this-quarter">This Quarter</option>
            <option value="this-year">This Year</option>
          </select>
          
          {/* Refresh Button */}
          <button 
            onClick={() => loadData()}
            disabled={refreshing}
            className="p-3 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center disabled:opacity-50 shadow-sm"
            title="Refresh data"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* --- Key Metrics Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${formatCurrency(S.totalRevenue)}`}
          change={12.5} // Mock change, calculated in API later
          icon={<DollarSign className="text-blue-600" size={20} />}
          bgColor="bg-blue-50"
          description="Gross sales for the period"
        />
        <MetricCard
          title="Units Sold"
          value={formatCurrency(S.unitsSold)}
          change={8.2} // Mock change
          icon={<ShoppingCart className="text-green-600" size={20} />}
          bgColor="bg-green-50"
          description="Total physical items shipped"
        />
        <MetricCard
          title="Profit Margin"
          value={`${S.profitMargin.toFixed(1)}%`}
          change={S.profitMargin > 30 ? 3.1 : -1.5} // Mock change based on value
          icon={<BarChart3 className="text-purple-600" size={20} />}
          bgColor="bg-purple-50"
          description="Net profit percentage of revenue"
        />
        <MetricCard
          title="Active Customers"
          value={formatCurrency(S.activeCustomers)}
          change={15.7} // Mock change
          icon={<Users className="text-orange-600" size={20} />}
          bgColor="bg-orange-50"
          description="Purchased in the selected period"
        />
      </div>

      {/* --- Main Analysis Area --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Chart and Chart Controls */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-md">
            
            {/* Chart Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <BarChart size={24} className="text-blue-600"/>
                    Revenue & Profit Trends
                </h3>
                <p className="text-slate-600 text-sm">
                    Monthly performance for {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                </p>
              </div>
              
              <div className="flex gap-2 p-1 border border-slate-200 rounded-lg bg-slate-50">
                <button 
                  onClick={() => setActiveChart('revenue')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeChart === 'revenue' 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-transparent text-slate-600 hover:bg-white'
                  }`}
                >
                  Revenue
                </button>
                <button 
                  onClick={() => setActiveChart('profit')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeChart === 'profit' 
                      ? 'bg-green-600 text-white shadow-md' 
                      : 'bg-transparent text-slate-600 hover:bg-white'
                  }`}
                >
                  Profit
                </button>
              </div>
            </div>
            
            {/* Chart Container */}
            <div className="relative h-96">
              {reportData.monthlyTrends.length > 0 ? (
                 <canvas 
                    ref={chartRef}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="flex justify-center items-center h-full text-slate-500">
                    <p>No sales data available for this period/category to show trends.</p>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Right Column: Key Insights */}
        <div className="space-y-6">

          {/* Top Categories */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <PieChart size={20} className="text-purple-600"/>
                Top Category Performance
            </h3>
            <div className="space-y-3">
              {reportData.topCategories.length > 0 ? (
                reportData.topCategories
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((category, index) => (
                  <div key={category.category} className="flex items-center justify-between p-3 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-blue-100 text-blue-600' :
                        index === 1 ? 'bg-green-100 text-green-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        {index + 1}
                      </span>
                      <h4 className="font-medium text-slate-900 truncate">{category.category}</h4>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">${formatCurrency(category.revenue)}</p>
                      <p className={`text-xs flex items-center justify-end ${
                        category.growth >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {category.growth >= 0 ? 
                          <ArrowUpRight className="w-3 h-3 mr-1" /> : 
                          <ArrowDownRight className="w-3 h-3 mr-1" />
                        }
                        {Math.abs(category.growth).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No categories with sales in this period.</p>
              )}
            </div>
          </div>

          {/* Inventory Health & Alerts */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Package size={20} className="text-orange-600"/>
                Inventory Health
            </h3>
            
            {/* Inventory Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xl font-bold text-slate-900">{formatCurrency(S.totalProducts)}</p>
                <p className="text-xs text-slate-600">Total Products</p>
              </div>
              <div className="text-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-xl font-bold text-slate-900">${(S.totalValue / 1000)}k</p>
                <p className="text-xs text-slate-600">Inventory Value (Cost)</p>
              </div>
            </div>

            {/* Stock Alerts */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-1">
                    <AlertTriangle size={16} className="text-red-500"/>
                    Critical Stock Alerts ({reportData.stockAlerts.length})
                </h4>
                {reportData.stockAlerts.length > 0 ? (
                  reportData.stockAlerts.map(alert => (
                      <div key={alert.product} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50">
                          <div className="flex-1 min-w-0">
                              <p className="font-medium text-red-800 truncate text-sm">{alert.product}</p>
                              <p className="text-xs text-red-600">
                                  Stock: **{alert.currentStock}** / Threshold: {alert.threshold}
                              </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              alert.status === 'out' 
                                  ? 'bg-red-700 text-white' 
                                  : 'bg-amber-500 text-white'
                          }`}>
                              {alert.status === 'out' ? 'OOS' : 'LOW'}
                          </span>
                      </div>
                  ))
                ) : (
                   <p className="text-sm text-slate-500">All products are within healthy stock limits.</p>
                )}
            </div>

          </div>
        </div>
      </div>
      
      {/* Export Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-md flex justify-between items-center mt-6">
        <div className='flex items-center gap-3'>
            <Download size={20} className='text-blue-600'/>
            <p className='text-slate-700 font-medium'>Generate PDF/CSV Report</p>
        </div>
        <div className='flex gap-2'>
            <button 
                onClick={() => alert("PDF generation handled by server API.")}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
                <FileText size={16} />
                PDF
            </button>
            <button 
                onClick={() => alert("CSV generation handled by server API.")}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm shadow-sm"
            >
                <FileText size={16} />
                CSV
            </button>
        </div>
      </div>
    </div>
  );
}
