import { useNavigate } from 'react-router-dom';

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-green-600 mb-4">Coming Soon</h1>
          <div className="w-24 h-1 bg-green-600 mx-auto mb-8"></div>
        </div>

        <p className="text-2xl text-gray-700 mb-6">
          We're working on something amazing
        </p>

        <p className="text-lg text-gray-600 mb-8">
          BuyTree is building the future of campus commerce. Stay tuned for updates.
        </p>

        {/* Login and Signup Buttons */}
        <div className="flex justify-center items-center space-x-4 mb-12">
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 bg-white border-2 border-green-600 text-green-600 rounded-lg font-semibold hover:bg-green-50 transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Sign Up
          </button>
        </div>

        <div className="flex justify-center items-center space-x-4 mt-12">
          <div className="w-3 h-3 bg-green-600 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
}
