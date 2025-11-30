import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30days');

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }

    fetchAnalytics();
  }, [user, navigate, period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch both revenue analytics and top products in parallel
      const [revenueResponse, topProductsResponse] = await Promise.all([
        axios.get(
          `${import.meta.env.VITE_API_URL}/admin/analytics/revenue?period=${period}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${import.meta.env.VITE_API_URL}/admin/analytics/top-products?period=${period}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);

      if (revenueResponse.data.success && topProductsResponse.data.success) {
        setAnalytics({
          ...revenueResponse.data.data,
          topProducts: topProductsResponse.data.data.topProducts
        });
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateTotals = (data) => {
    if (!data) return { revenue: 0, commission: 0, orders: 0 };
    return data.reduce((acc, item) => ({
      revenue: acc.revenue + parseFloat(item.revenue || 0),
      commission: acc.commission + parseFloat(item.commission || 0),
      orders: acc.orders + parseInt(item.order_count || 0),
    }), { revenue: 0, commission: 0, orders: 0 });
  };

  const totals = analytics ? calculateTotals(analytics.dailyRevenue) : { revenue: 0, commission: 0, orders: 0 };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Revenue Analytics</h1>
              <p className="text-sm text-gray-600 mt-1">
                Platform revenue and performance insights
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/admin/sellers')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Sellers
              </button>
              <button
                onClick={() => navigate('/admin/orders')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Orders
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="1year">Last Year</option>
          </select>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">{formatPrice(totals.revenue)}</p>
                <p className="text-xs text-gray-500 mt-2">{totals.orders} orders</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-2">Platform Commission</p>
                <p className="text-3xl font-bold text-green-600">{formatPrice(totals.commission)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {((totals.commission / totals.revenue) * 100 || 0).toFixed(1)}% of revenue
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-2">Average Order Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatPrice(totals.orders > 0 ? totals.revenue / totals.orders : 0)}
                </p>
                <p className="text-xs text-gray-500 mt-2">Across {totals.orders} orders</p>
              </div>
            </div>

            {/* Daily Revenue Chart */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Daily Revenue Trend</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Orders</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics?.dailyRevenue?.length > 0 ? (
                      analytics.dailyRevenue.map((day, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">{formatDate(day.date)}</td>
                          <td className="py-3 px-4 text-sm text-right text-gray-900">{day.order_count}</td>
                          <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">
                            {formatPrice(day.revenue)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-semibold text-green-600">
                            {formatPrice(day.commission)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-gray-500">
                          No revenue data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Sellers */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Performing Sellers</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Rank</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Shop</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Orders</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics?.topSellers?.length > 0 ? (
                      analytics.topSellers.map((seller, index) => (
                        <tr key={seller.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                              index === 0 ? 'bg-yellow-100 text-yellow-800' :
                              index === 1 ? 'bg-gray-200 text-gray-700' :
                              index === 2 ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">{seller.shop_name}</div>
                            <div className="text-sm text-gray-500">/{seller.shop_slug}</div>
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-gray-900">
                            {seller.total_orders}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">
                            {formatPrice(seller.total_revenue)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-semibold text-green-600">
                            {formatPrice(seller.total_commission)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-500">
                          No seller data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Performance */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Category Performance</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Category</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Orders</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics?.categoryPerformance?.length > 0 ? (
                      analytics.categoryPerformance.map((category, index) => {
                        const percentage = (parseFloat(category.revenue) / totals.revenue) * 100;
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm font-medium text-gray-900 capitalize">
                              {category.category}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-900">
                              {category.order_count}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">
                              {formatPrice(category.revenue)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600">
                              {percentage.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-gray-500">
                          No category data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Performing Products */}
            <div className="bg-white rounded-lg shadow p-6 mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Performing Products</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Rank</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Product</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Seller</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Units Sold</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics?.topProducts?.length > 0 ? (
                      analytics.topProducts.map((product, index) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                              index === 0 ? 'bg-yellow-100 text-yellow-800' :
                              index === 1 ? 'bg-gray-200 text-gray-700' :
                              index === 2 ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              {product.image_urls && product.image_urls.length > 0 ? (
                                <img
                                  src={product.image_urls[0]}
                                  alt={product.name}
                                  className="w-12 h-12 rounded object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                                  <span className="text-gray-400 text-xs">No image</span>
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-gray-900">{product.shop_name}</div>
                            <div className="text-sm text-gray-500">/{product.shop_slug}</div>
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-gray-900">
                            {product.units_sold}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">
                            {formatPrice(product.total_revenue)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-500">
                          No product data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
