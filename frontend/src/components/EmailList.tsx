import { useState } from 'react';
import { Search, RefreshCw, SlidersHorizontal, Star } from 'lucide-react';

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

interface EmailListProps {
  emails: Email[];
  tab: 'scheduled' | 'sent';
  loading: boolean;
  onRefresh: () => void;
  onSelectEmail: (emailId: string) => void;
}

export default function EmailList({
  emails,
  tab,
  loading,
  onRefresh,
  onSelectEmail,
}: EmailListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Format database timestamp to look like Figma: "Tue 9:15:12 AM" or "Today at 07:51 PM"
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Check if it is today
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${timeString}`;
    }
    
    // Check if it is tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${timeString}`;
    }
    
    // Otherwise return Day of week + short time
    const day = date.toLocaleDateString([], { weekday: 'short' });
    return `${day} ${timeString}`;
  };

  // Filter emails based on search query
  const filteredEmails = emails.filter((email) => {
    const query = searchQuery.toLowerCase();
    return (
      email.recipient.toLowerCase().includes(query) ||
      email.subject.toLowerCase().includes(query) ||
      email.body.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex-1 flex flex-col h-screen bg-white select-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between p-4 border-b border-gray-50 gap-4">
        {/* Search Input */}
        <div className="flex-1 max-w-xl relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm text-gray-800"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 active:bg-gray-100 rounded-xl cursor-pointer transition-all">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={onRefresh}
            className={`p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 active:bg-gray-100 rounded-xl cursor-pointer transition-all ${
              loading ? 'animate-spin text-green-500' : ''
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Email Rows List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          // Loading State
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-400 font-medium">Loading emails...</p>
          </div>
        ) : filteredEmails.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-gray-400 font-medium text-sm">
              {searchQuery ? 'No results match your search.' : `No ${tab} emails found.`}
            </p>
          </div>
        ) : (
          // List view
          <div className="divide-y divide-gray-50">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email.id)}
                className="flex items-center p-4 hover:bg-gray-50/50 cursor-pointer transition-all group"
              >
                {/* Recipient */}
                <div className="w-48 pr-4 font-semibold text-gray-800 text-sm truncate shrink-0">
                  To: {email.recipient.split('@')[0]}
                </div>

                {/* Staggered Delay or Status Badge */}
                <div className="w-48 pr-4 shrink-0">
                  {email.status === 'SENT' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                      Sent
                    </span>
                  )}
                  {email.status === 'FAILED' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-500 border border-red-100">
                      Failed
                    </span>
                  )}
                  {email.status === 'PROCESSING' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-500 border border-blue-100 animate-pulse">
                      Sending...
                    </span>
                  )}
                  {email.status === 'PENDING' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
                      {formatTime(email.scheduledAt)}
                    </span>
                  )}
                </div>

                {/* Subject & Snippet */}
                <div className="flex-1 min-w-0 pr-4 flex items-baseline gap-2">
                  <span className="font-semibold text-gray-800 text-sm truncate shrink-0">
                    {email.subject}
                  </span>
                  <span className="text-gray-400 text-xs truncate">
                    — {email.body}
                  </span>
                </div>

                {/* Star icon at the end */}
                <button
                  onClick={(e) => e.stopPropagation()} // Prevent clicking star from opening the email
                  className="text-gray-300 hover:text-amber-400 p-1 cursor-pointer transition-colors"
                >
                  <Star className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
