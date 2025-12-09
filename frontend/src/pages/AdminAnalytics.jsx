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
    <div className="page-container">
      {/* Header */}
      <div className="nav-header">
        <div className="nav-content">
          <div className="flex-between">
            <div>
              <h1 className="heading-xl">Revenue Analytics</h1>
              <p className="text-muted">
                Platform revenue and performance insights
              </p>
            </div>
            <div className="nav-links">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="btn-secondary"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/admin/sellers')}
                className="btn-secondary"
              >
                Sellers
              </button>
              <button
                onClick={() => navigate('/admin/orders')}
                className="btn-secondary"
              >
                Orders
              </button>
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

      {/* Main Content */}
      <div className="content-wrapper">
        {/* Period Selector */}
        <div className="card mb-6">
          <label className="form-label">
            Time Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="form-select"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="1year">Last Year</option>
          </select>
        </div>

        {loading ? (
          <div className="card text-center">
            <div className="loading-spinner-lg"></div>
            <p className="loading-text">Loading analytics...</p>
          </div>
        ) : error ? (
          <div className="card text-center">
            <p className="error-text">{error}</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <p className="stat-label">Total Revenue</p>
                <p className="stat-value">{formatPrice(totals.revenue)}</p>
                <p className="stat-description">{totals.orders} orders</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Platform Commission</p>
                <p className="stat-value-green">{formatPrice(totals.commission)}</p>
                <p className="stat-description">
                  {((totals.commission / totals.revenue) * 100 || 0).toFixed(1)}% of revenue
                </p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Average Order Value</p>
                <p className="stat-value">
                  {formatPrice(totals.orders > 0 ? totals.revenue / totals.orders : 0)}
                </p>
                <p className="stat-description">Across {totals.orders} orders</p>
              </div>
            </div>

            {/* Daily Revenue Chart */}
            <div className="card-section">
              <h2 className="section-header-mb-6">Daily Revenue Trend</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr className="table-header-row">
                      <th className="table-header-cell">Date</th>
                      <th className="table-header-cell-right">Orders</th>
                      <th className="table-header-cell-right">Revenue</th>
                      <th className="table-header-cell-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {analytics?.dailyRevenue?.length > 0 ? (
                      analytics.dailyRevenue.map((day, index) => (
                        <tr key={index} className="table-row">
                          <td className="table-cell">{formatDate(day.date)}</td>
                          <td className="table-cell-right">{day.order_count}</td>
                          <td className="table-cell-right-bold">
                            {formatPrice(day.revenue)}
                          </td>
                          <td className="table-cell-right-green">
                            {formatPrice(day.commission)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="empty-state">
                          No revenue data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Sellers */}
            <div className="card-section">
              <h2 className="section-header-mb-6">Top Performing Sellers</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr className="table-header-row">
                      <th className="table-header-cell">Rank</th>
                      <th className="table-header-cell">Shop</th>
                      <th className="table-header-cell-right">Orders</th>
                      <th className="table-header-cell-right">Revenue</th>
                      <th className="table-header-cell-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {analytics?.topSellers?.length > 0 ? (
                      analytics.topSellers.map((seller, index) => (
                        <tr key={seller.id} className="table-row">
                          <td className="table-cell">
                            <span className={
                              index === 0 ? 'rank-badge-gold' :
                              index === 1 ? 'rank-badge-silver' :
                              index === 2 ? 'rank-badge-bronze' :
                              'rank-badge'
                            }>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="table-primary-text">{seller.shop_name}</div>
                            <div className="table-secondary-text">/{seller.shop_slug}</div>
                          </td>
                          <td className="table-cell-right">
                            {seller.total_orders}
                          </td>
                          <td className="table-cell-right-bold">
                            {formatPrice(seller.total_revenue)}
                          </td>
                          <td className="table-cell-right-green">
                            {formatPrice(seller.total_commission)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty-state">
                          No seller data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Performance */}
            <div className="card-section">
              <h2 className="section-header-mb-6">Category Performance</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr className="table-header-row">
                      <th className="table-header-cell">Category</th>
                      <th className="table-header-cell-right">Orders</th>
                      <th className="table-header-cell-right">Revenue</th>
                      <th className="table-header-cell-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {analytics?.categoryPerformance?.length > 0 ? (
                      analytics.categoryPerformance.map((category, index) => {
                        const percentage = (parseFloat(category.revenue) / totals.revenue) * 100;
                        return (
                          <tr key={index} className="table-row">
                            <td className="table-cell-medium capitalize">
                              {category.category}
                            </td>
                            <td className="table-cell-right">
                              {category.order_count}
                            </td>
                            <td className="table-cell-right-bold">
                              {formatPrice(category.revenue)}
                            </td>
                            <td className="table-cell-right-muted">
                              {percentage.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="empty-state">
                          No category data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Performing Products */}
            <div className="card-section-mt">
              <h2 className="section-header-mb-6">Top Performing Products</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr className="table-header-row">
                      <th className="table-header-cell">Rank</th>
                      <th className="table-header-cell">Product</th>
                      <th className="table-header-cell">Seller</th>
                      <th className="table-header-cell-right">Units Sold</th>
                      <th className="table-header-cell-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {analytics?.topProducts?.length > 0 ? (
                      analytics.topProducts.map((product, index) => (
                        <tr key={product.id} className="table-row">
                          <td className="table-cell">
                            <span className={
                              index === 0 ? 'rank-badge-gold' :
                              index === 1 ? 'rank-badge-silver' :
                              index === 2 ? 'rank-badge-bronze' :
                              'rank-badge'
                            }>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="product-cell-flex">
                              {product.image_urls && product.image_urls.length > 0 ? (
                                <img
                                  src={product.image_urls[0]}
                                  alt={product.name}
                                  className="product-image-sm"
                                />
                              ) : (
                                <div className="product-image-placeholder">
                                  <span className="product-image-placeholder-text">No image</span>
                                </div>
                              )}
                              <div>
                                <div className="table-primary-text">{product.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="table-primary-text">{product.shop_name}</div>
                            <div className="table-secondary-text">/{product.shop_slug}</div>
                          </td>
                          <td className="table-cell-right">
                            {product.units_sold}
                          </td>
                          <td className="table-cell-right-bold">
                            {formatPrice(product.total_revenue)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty-state">
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
