import { useNavigate } from 'react-router-dom';

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="coming-soon-container">
      <div className="coming-soon-content">
        <div className="mb-8">
          <h1 className="coming-soon-title">Coming Soon</h1>
          <div className="coming-soon-divider"></div>
        </div>

        <p className="coming-soon-subtitle">
          We're working on something amazing
        </p>

        <p className="coming-soon-text">
          BuyTree is building the future of campus commerce. Stay tuned for updates.
        </p>

        {/* Login and Signup Buttons */}
        <div className="coming-soon-buttons">
          <button
            onClick={() => navigate('/login')}
            className="btn-outline-primary"
          >
            Login
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="btn-primary"
          >
            Sign Up
          </button>
        </div>

        <div className="coming-soon-dots">
          <div className="loading-dot"></div>
          <div className="loading-dot" style={{ animationDelay: '0.1s' }}></div>
          <div className="loading-dot" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
}
