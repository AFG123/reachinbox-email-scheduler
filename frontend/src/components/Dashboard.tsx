import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import EmailList from './EmailList';
import EmailDetail from './EmailDetail';
import ComposeView from './ComposeView';
import { API_URL } from '../config';

const API_BASE_URL = `${API_URL}/api/emails`;

interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  sender: {
    email: string;
    displayName: string;
  };
}

interface Sender {
  id: string;
  email: string;
  displayName: string;
}

interface DashboardProps {
  user: { name: string; email: string; avatarUrl: string };
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  // Navigation states
  const [currentTab, setCurrentTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [currentView, setCurrentView] = useState<'list' | 'compose' | 'detail'>('list');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // Data states
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all senders, scheduled emails, and sent emails
  const fetchData = async (showLoadingIndicator = false) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      // 1. Fetch senders (if not loaded yet)
      if (senders.length === 0) {
        const sendersRes = await axios.get(`${API_BASE_URL}/senders`);
        setSenders(sendersRes.data);
      }

      // 2. Fetch scheduled emails
      const scheduledRes = await axios.get(`${API_BASE_URL}/scheduled`);
      setScheduledEmails(scheduledRes.data);

      // 3. Fetch sent logs
      const sentRes = await axios.get(`${API_BASE_URL}/sent`);
      setSentEmails(sentRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      if (showLoadingIndicator) setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchData(true);
  }, []);

  // Real-time updates: poll the database every 3 seconds to update email status live
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData(false); // poll silently in background without loading spinners
    }, 3000);

    return () => clearInterval(timer);
  }, [senders]);

  // Handle scheduling campaign
  const handleScheduleCampaign = async (campaignData: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delayMs: number;
    hourlyLimit: number;
  }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/schedule`, campaignData);
      console.log('Campaign Scheduled:', response.data);
      // Instantly trigger a refresh
      fetchData(false);
      return true;
    } catch (error: any) {
      const errMsg = error.response?.data?.error || 'Failed to schedule campaign.';
      alert(`Scheduling Error: ${errMsg}`);
      return false;
    }
  };

  // Handle email deletion (Mocked on frontend to immediately remove from view)
  const handleDeleteEmail = (emailId: string) => {
    setScheduledEmails((prev) => prev.filter((e) => e.id !== emailId));
    setSentEmails((prev) => prev.filter((e) => e.id !== emailId));
    setCurrentView('list');
    setSelectedEmailId(null);
  };

  // Destroy session on the backend and log out
  const handleLogout = async () => {
    try {
      await axios.get(`${API_URL}/api/auth/logout`);
    } catch (error) {
      console.error('Failed to logout on backend:', error);
    } finally {
      onLogout();
    }
  };

  // Find currently selected email details
  const selectedEmail =
    scheduledEmails.find((e) => e.id === selectedEmailId) ||
    sentEmails.find((e) => e.id === selectedEmailId);

  // Determine current active list
  const activeEmailsList = currentTab === 'scheduled' ? scheduledEmails : sentEmails;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white font-sans antialiased text-gray-800">
      
      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        currentTab={currentTab}
        currentView={currentView}
        scheduledCount={scheduledEmails.length}
        sentCount={sentEmails.length}
        setTab={setCurrentTab}
        setView={setCurrentView}
        onLogout={handleLogout}
      />

      {/* Main Right Content Section */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {currentView === 'compose' ? (
          <ComposeView
            senders={senders}
            onBack={() => setCurrentView('list')}
            onSchedule={handleScheduleCampaign}
          />
        ) : currentView === 'detail' && selectedEmail ? (
          <EmailDetail
            email={selectedEmail}
            onBack={() => {
              setCurrentView('list');
              setSelectedEmailId(null);
            }}
            onDelete={handleDeleteEmail}
          />
        ) : (
          <EmailList
            emails={activeEmailsList}
            tab={currentTab}
            loading={loading}
            onRefresh={() => fetchData(true)}
            onSelectEmail={(id) => {
              setSelectedEmailId(id);
              setCurrentView('detail');
            }}
          />
        )}
      </main>

    </div>
  );
}
