import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { API_URL } from './config';

// Configure Axios globally to send cookies for cross-origin requests
axios.defaults.withCredentials = true;

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if session is already active on app load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/auth/me`);
        setUser(response.data);
      } catch (error) {
        // Unauthorized, user needs to login
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#00a854] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-400 font-medium select-none">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-white">
      {user === null ? (
        <Login />
      ) : (
        <Dashboard user={user} onLogout={() => setUser(null)} />
      )}
    </div>
  );
}

export default App;
