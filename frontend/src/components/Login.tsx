import { useState, FormEvent } from 'react';

interface LoginProps {
  onLoginSuccess: (user: { id: string; name: string; email: string; avatarUrl: string }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Trigger mock login for testing before Google OAuth is set up
  const handleMockLogin = (e: FormEvent) => {
    e.preventDefault();
    alert('Traditional email sign-ups are disabled for this project. Please use "Login with Google".');
  };

  const handleGoogleLogin = () => {
    // Redirect browser directly to the backend OAuth initialization URL
    window.location.href = 'http://localhost:5000/api/auth/google';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 p-10 shadow-sm">
        <h2 className="text-center text-3xl font-bold text-gray-900 mb-8">Login</h2>
        
        {/* Google OAuth Login Button */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors font-medium text-sm cursor-pointer mb-6"
        >
          {/* Simple Google SVG Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Login with Google
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400">or sign up through email</span>
          </div>
        </div>

        {/* Traditional Credentials Form (Mocked) */}
        <form onSubmit={handleMockLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              required
              className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all text-sm text-gray-800"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all text-sm text-gray-800"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#00a854] hover:bg-green-600 active:bg-green-700 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm cursor-pointer shadow-sm shadow-green-100"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
