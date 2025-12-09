import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(''); // Clear error on input change
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      // Get redirect parameter or determine default based on user role
      const redirectParam = searchParams.get('redirect');

      // Wait a bit for user data to be available
      setTimeout(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (redirectParam) {
          // Use redirect parameter if provided
          navigate(redirectParam);
        } else if (user.role === 'admin') {
          // Admins go to admin dashboard
          navigate('/admin/dashboard');
        } else if (user.role === 'seller') {
          // Sellers go to dashboard
          navigate('/seller/dashboard');
        } else {
          // Buyers have no default page, stay on current page or go to orders
          navigate('/orders');
        }
      }, 100);
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-form-wrapper">
        <div>
          <h2 className="auth-title">
            Welcome back to BuyTree
          </h2>
          <p className="auth-subtitle">
            Or{' '}
            <Link to="/signup" className="link-primary">
              create a new account
            </Link>
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="alert-error">
              <div className="alert-text">{error}</div>
            </div>
          )}

          <div className="form-input-group">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="form-input-top"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="form-input-bottom"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="link-primary"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-full"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
