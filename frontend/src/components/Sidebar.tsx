import { useState } from 'react';
import { Clock, Send, PenSquare, LogOut, ChevronDown } from 'lucide-react';

interface SidebarProps {
  user: { name: string; email: string; avatarUrl: string };
  currentTab: 'scheduled' | 'sent';
  currentView: 'list' | 'compose' | 'detail';
  scheduledCount: number;
  sentCount: number;
  setTab: (tab: 'scheduled' | 'sent') => void;
  setView: (view: 'list' | 'compose' | 'detail') => void;
  onLogout: () => void;
}

export default function Sidebar({
  user,
  currentTab,
  currentView,
  scheduledCount,
  sentCount,
  setTab,
  setView,
  onLogout,
}: SidebarProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleComposeClick = () => {
    setView('compose');
  };

  const handleTabClick = (tab: 'scheduled' | 'sent') => {
    setTab(tab);
    setView('list');
  };

  return (
    <aside className="w-64 border-r border-gray-100 h-screen bg-white flex flex-col p-4 shrink-0 select-none">
      {/* ONB Logo */}
      {/* <div className="px-3 py-4">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">ONB</h1>
      </div> */}

      {/* User Profile Card Dropdown */}
      <div className="relative mb-6">
        <div
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100/80 active:bg-gray-100 rounded-xl cursor-pointer transition-colors"
        >
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-10 h-10 rounded-full object-cover bg-gray-200 border border-gray-100"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-800 truncate">{user.name}</h2>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>

        {/* Dropdown Options */}
        {showDropdown && (
          <div className="absolute right-0 left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg z-50 p-1">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Compose Button */}
      <button
        onClick={handleComposeClick}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 border border-[#00a854] text-[#00a854] hover:bg-green-50/50 active:bg-green-50 rounded-xl transition-all font-semibold text-sm cursor-pointer mb-8`}
      >
        <PenSquare className="w-4 h-4" />
        Compose
      </button>

      {/* Navigation Options */}
      <nav className="flex-1 space-y-1">
        <div className="text-xs uppercase font-bold text-gray-400 px-3 mb-2 tracking-widest">
          Core
        </div>

        {/* Scheduled Tab Link */}
        <button
          onClick={() => handleTabClick('scheduled')}
          className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors cursor-pointer text-sm font-medium ${
            currentTab === 'scheduled' && currentView === 'list'
              ? 'bg-green-50/60 text-[#00a854]'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4" />
            <span>Scheduled</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            currentTab === 'scheduled' && currentView === 'list'
              ? 'bg-green-100 text-[#00a854]'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {scheduledCount}
          </span>
        </button>

        {/* Sent Tab Link */}
        <button
          onClick={() => handleTabClick('sent')}
          className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors cursor-pointer text-sm font-medium ${
            currentTab === 'sent' && currentView === 'list'
              ? 'bg-green-50/60 text-[#00a854]'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Send className="w-4 h-4" />
            <span>Sent</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            currentTab === 'sent' && currentView === 'list'
              ? 'bg-green-100 text-[#00a854]'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {sentCount}
          </span>
        </button>
      </nav>
    </aside>
  );
}
