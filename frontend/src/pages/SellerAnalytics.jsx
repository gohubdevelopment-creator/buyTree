import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyticsService } from '../services/api';
import { BarChart } from '@mui/x-charts/BarChart';

export default function SellerAnalytics() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // View analytics state
  const [viewAnalytics, setViewAnalytics] = useState(null);
  const [viewPeriod, setViewPeriod] = useState('30');
  const [viewsLoading, setViewsLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'seller') {
      navigate('/login');
      return;
    }
    fetchAnalytics();
    fetchViewAnalytics();
  }, [user, navigate]);

  useEffect(() => {
    if (user?.role === 'seller') {
      fetchViewAnalytics();
    }
  }, [viewPeriod]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await analyticsService.getSellerAnalytics();
      setAnalytics(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load analytics');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchViewAnalytics = async () => {
    try {
      setViewsLoading(true);
      const response = await analyticsService.getProductViewAnalytics(viewPeriod);
      setViewAnalytics(response.data);
    } catch (err) {
      console.error('View analytics error:', err);
    } finally {
      setViewsLoading(false);
    }
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="page-container flex-center">
        <div className="text-center">
          <div className="loading-spinner-lg"></div>
          <p className="loading-text">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container flex-center">
        <div className="text-center">
          <p className="error-text">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="btn-primary mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overview, revenue_by_day, top_products, low_stock_products, recent_orders } = analytics || {};

  // Calculate max revenue for chart scaling
  const maxRevenue = Math.max(...(revenue_by_day || []).map((day) => parseFloat(day.revenue)));

  return (
    <div className="page-container">
      {/* Header */}
      <div className="nav-header">
        <div className="nav-content">
          <div className="flex-between">
            <div>
              <h1 className="heading-xl">Analytics Dashboard</h1>
              <p className="text-muted">Track your sales performance and insights</p>
            </div>
            <div className="nav-links">
              <Link
                to="/seller/dashboard"
                className="btn-secondary"
              >
                Products
              </Link>
              <Link
                to="/seller/orders"
                className="btn-secondary"
              >
                Orders
              </Link>
              <button
                onClick={logout}
                className="btn-danger"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="content-wrapper">
        {/* Overview Stats */}
        <div className="grid-4 mb-8">
          {/* Total Revenue */}
          <div className="stat-card-green">
            <div className="flex-between">
              <div>
                <p className="stat-label">Total Revenue</p>
                <p className="stat-value-lg">
                  {formatPrice(parseFloat(overview?.total_revenue) || 0)}
                </p>
                {overview?.revenue_growth_percentage !== 0 && (
                  <p
                    className={`text-sm mt-1 ${
                      overview?.revenue_growth_percentage > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {overview?.revenue_growth_percentage > 0 ? '+' : ''}
                    {overview?.revenue_growth_percentage?.toFixed(1)}% from last month
                  </p>
                )}
              </div>
              <div className="icon-container-green">
                <svg className="icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Orders */}
          <div className="stat-card-blue">
            <div className="flex-between">
              <div>
                <p className="stat-label">Total Orders</p>
                <p className="stat-value-lg">{overview?.total_orders || 0}</p>
                {overview?.order_growth_percentage !== 0 && (
                  <p
                    className={`text-sm mt-1 ${
                      overview?.order_growth_percentage > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {overview?.order_growth_percentage > 0 ? '+' : ''}
                    {overview?.order_growth_percentage?.toFixed(1)}% from last month
                  </p>
                )}
              </div>
              <div className="icon-container-blue">
                <svg className="icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="stat-card-purple">
            <div className="flex-between">
              <div>
                <p className="stat-label">Avg. Order Value</p>
                <p className="stat-value-lg">
                  {formatPrice(parseFloat(overview?.average_order_value) || 0)}
                </p>
              </div>
              <div className="icon-container-purple">
                <svg className="icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Pending Orders */}
          <div className="stat-card-yellow">
            <div className="flex-between">
              <div>
                <p className="stat-label">Pending Orders</p>
                <p className="stat-value-lg">{overview?.pending_orders || 0}</p>
                <p className="stat-description">Need your attention</p>
              </div>
              <div className="icon-container-yellow">
                <svg className="icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div className="card-section">
          <h2 className="section-header-mb-4">Order Status Breakdown</h2>
          <div className="status-grid">
            <div className="status-card-yellow">
              <p className="status-value">{overview?.pending_orders || 0}</p>
              <p className="status-label">Pending</p>
            </div>
            <div className="status-card-blue">
              <p className="status-value">{overview?.processing_orders || 0}</p>
              <p className="status-label">Processing</p>
            </div>
            <div className="status-card-purple">
              <p className="status-value">{overview?.shipped_orders || 0}</p>
              <p className="status-label">Shipped</p>
            </div>
            <div className="status-card-green">
              <p className="status-value">{overview?.delivered_orders || 0}</p>
              <p className="status-label">Delivered</p>
            </div>
          </div>
        </div>

        {/* Revenue Chart - Last 30 Days */}
        <div className="card-section">
          <h2 className="section-header-mb-4">Revenue (Last 30 Days)</h2>
          {revenue_by_day && revenue_by_day.length > 0 ? (
            <div className="space-y-4">
              {/* MUI BarChart */}
              <div className="w-full" style={{ height: '400px' }}>
                <BarChart
                  dataset={revenue_by_day.map(day => ({
                    date: formatDate(day.date),
                    revenue: parseFloat(day.revenue) || 0,
                    orders: parseInt(day.orders_count) || 0,
                  }))}
                  xAxis={[{
                    scaleType: 'band',
                    dataKey: 'date',
                    tickLabelStyle: {
                      angle: -45,
                      textAnchor: 'end',
                      fontSize: 11,
                    },
                  }]}
                  yAxis={[{
                    label: 'Revenue (₦)',
                    valueFormatter: (value) => formatPrice(value),
                  }]}
                  series={[
                    {
                      dataKey: 'revenue',
                      label: 'Daily Revenue',
                      color: '#10b981',
                      valueFormatter: (value) => formatPrice(value),
                    }
                  ]}
                  grid={{ horizontal: true }}
                  margin={{ top: 20, right: 20, bottom: 80, left: 80 }}
                  slotProps={{
                    legend: { hidden: false },
                  }}
                />
              </div>

              {/* Summary stats below chart */}
              <div className="grid-3 pt-4 border-t border-gray-200">
                <div className="text-center">
                  <p className="stat-label-sm">Total Revenue</p>
                  <p className="stat-value-md">
                    {formatPrice(revenue_by_day.reduce((sum, day) => sum + parseFloat(day.revenue || 0), 0))}
                  </p>
                </div>
                <div className="text-center">
                  <p className="stat-label-sm">Total Orders</p>
                  <p className="stat-value-md">
                    {revenue_by_day.reduce((sum, day) => sum + parseInt(day.orders_count || 0), 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="stat-label-sm">Daily Average</p>
                  <p className="stat-value-md">
                    {formatPrice(
                      revenue_by_day.reduce((sum, day) => sum + parseFloat(day.revenue || 0), 0) /
                      revenue_by_day.length
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state-bg">
              <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>No revenue data available</p>
              <p className="empty-state-subtitle">Start making sales to see your revenue chart</p>
            </div>
          )}
        </div>

        {/* Product Views Analytics */}
        <div className="card-section">
          <div className="flex-between mb-4">
            <h2 className="section-header">Product Views</h2>
            <select
              value={viewPeriod}
              onChange={(e) => setViewPeriod(e.target.value)}
              className="form-select-sm"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>

          {viewsLoading ? (
            <div className="text-center py-12">
              <div className="loading-spinner-md"></div>
              <p className="loading-text">Loading views...</p>
            </div>
          ) : viewAnalytics ? (
            <div className="space-y-6">
              {/* Views Summary */}
              <div className="grid-2">
                <div className="stat-card-indigo">
                  <p className="stat-label-sm mb-1">Total Views (All Time)</p>
                  <p className="stat-value">{viewAnalytics.totalViews?.toLocaleString() || 0}</p>
                </div>
                <div className="stat-card-blue">
                  <p className="stat-label-sm mb-1">Views (Last {viewPeriod} Days)</p>
                  <p className="stat-value">{viewAnalytics.periodViews?.toLocaleString() || 0}</p>
                </div>
              </div>

              {/* Most Viewed Products */}
              <div>
                <h3 className="heading-md mb-3">Most Viewed Products</h3>
                {viewAnalytics.mostViewedProducts && viewAnalytics.mostViewedProducts.length > 0 ? (
                  <div className="space-y-3">
                    {viewAnalytics.mostViewedProducts.map((product, index) => (
                      <div key={product.id} className="product-card-hover">
                        <div className="rank-number-container">
                          <span className="rank-number">#{index + 1}</span>
                        </div>
                        {product.image_urls && product.image_urls.length > 0 ? (
                          <img
                            src={product.image_urls[0]}
                            alt={product.name}
                            className="product-image-md"
                          />
                        ) : (
                          <div className="product-image-placeholder-md">
                            <svg className="icon-lg text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="product-title">{product.name}</h4>
                          <p className="product-price">{formatPrice(parseFloat(product.price))}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex flex-col items-end">
                            <p className="view-count-primary">
                              {parseInt(product.period_views || 0).toLocaleString()} views
                            </p>
                            <p className="view-count-secondary">
                              {parseInt(product.total_views || 0).toLocaleString()} total
                            </p>
                          </div>
                          {product.quantity_available !== undefined && (
                            <p className="stock-info">
                              {product.quantity_available} in stock
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-bg">
                    <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <p className="empty-state-text">No product views yet</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Unable to load view analytics</p>
            </div>
          )}
        </div>

        <div className="grid-2-lg mb-8">
          {/* Top Selling Products */}
          <div className="card">
            <h2 className="section-header-mb-4">Top Selling Products</h2>
            {top_products && top_products.length > 0 ? (
              <div className="space-y-4">
                {top_products.slice(0, 5).map((product) => (
                  <div key={product.id} className="product-list-item">
                    {product.image_urls && product.image_urls.length > 0 ? (
                      <img
                        src={product.image_urls[0]}
                        alt={product.name}
                        className="product-image-md"
                      />
                    ) : (
                      <div className="product-image-placeholder-md">
                        <svg className="icon-lg text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="product-title">{product.name}</h3>
                      <p className="product-price">{formatPrice(parseFloat(product.price))}</p>
                    </div>
                    <div className="text-right">
                      <p className="product-stats-primary">{product.units_sold || 0} sold</p>
                      <p className="product-revenue">{formatPrice(parseFloat(product.revenue) || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No sales data yet</div>
            )}
          </div>

          {/* Low Stock Alert */}
          <div className="card">
            <h2 className="section-header-mb-4">Low Stock Alert</h2>
            {low_stock_products && low_stock_products.length > 0 ? (
              <div className="space-y-4">
                {low_stock_products.map((product) => (
                  <div key={product.id} className="product-list-item">
                    {product.image_urls && product.image_urls.length > 0 ? (
                      <img
                        src={product.image_urls[0]}
                        alt={product.name}
                        className="product-image-md"
                      />
                    ) : (
                      <div className="product-image-placeholder-md">
                        <svg className="icon-lg text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="product-title">{product.name}</h3>
                      <p className="product-price">{formatPrice(parseFloat(product.price))}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`badge-stock ${
                          product.quantity_available === 0
                            ? 'badge-stock-empty'
                            : 'badge-stock-low'
                        }`}
                      >
                        {product.quantity_available} left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">All products are well stocked</div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="flex-between mb-4">
            <h2 className="section-header">Recent Orders</h2>
            <Link to="/seller/orders" className="link-primary">
              View All Orders →
            </Link>
          </div>
          {recent_orders && recent_orders.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr className="table-header-row-alt">
                    <th className="table-header-cell-alt">
                      Order ID
                    </th>
                    <th className="table-header-cell-alt">
                      Customer
                    </th>
                    <th className="table-header-cell-alt">
                      Amount
                    </th>
                    <th className="table-header-cell-alt">
                      Status
                    </th>
                    <th className="table-header-cell-alt">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="table-body-alt">
                  {recent_orders.map((order) => (
                    <tr key={order.id} className="table-row">
                      <td className="table-cell-compact-bold">
                        #{order.order_number}
                      </td>
                      <td className="table-cell-compact">
                        {order.first_name} {order.last_name}
                      </td>
                      <td className="table-cell-compact">
                        {formatPrice(parseFloat(order.seller_amount))}
                      </td>
                      <td className="table-cell-compact">
                        <span className={`badge ${getStatusBadgeColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="table-cell-compact-muted">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No orders yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
