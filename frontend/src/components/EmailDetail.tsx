import { ArrowLeft, Star, Trash2, Archive, AlertTriangle } from 'lucide-react';

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

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onDelete: (emailId: string) => void;
}

export default function EmailDetail({ email, onBack, onDelete }: EmailDetailProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-white overflow-hidden">
      {/* Top Action Bar */}
      <header className="flex items-center justify-between p-4 border-b border-gray-50 select-none">
        <button
          onClick={onBack}
          className="flex items-center gap-2 p-2 hover:bg-gray-50 active:bg-gray-100 rounded-xl cursor-pointer transition-colors text-gray-600 text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl cursor-pointer transition-all">
            <Star className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl cursor-pointer transition-all">
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(email.id)}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Email Workspace Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto">
        
        {/* Email Failure Warning (if applicable) */}
        {email.status === 'FAILED' && (
          <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Delivery Failed</h4>
              <p className="text-xs text-red-600/90 mt-1">{email.lastError || 'Unknown SMTP socket failure.'}</p>
            </div>
          </div>
        )}

        {/* Email Processing Alert */}
        {email.status === 'PROCESSING' && (
          <div className="mb-6 flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-700 animate-pulse">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
            <div>
              <h4 className="font-bold text-sm">Processing Delivery</h4>
              <p className="text-xs text-blue-600/90 mt-1">This email is currently being transmitted through Ethereal SMTP.</p>
            </div>
          </div>
        )}

        {/* Email Pending Info */}
        {email.status === 'PENDING' && (
          <div className="mb-6 flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Scheduled Delivery</h4>
              <p className="text-xs text-amber-700/90 mt-1">
                This email is queued in BullMQ. It will send at {new Date(email.scheduledAt).toLocaleString()}.
              </p>
            </div>
          </div>
        )}

        {/* Subject Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{email.subject}</h1>

        {/* Sender details row */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center font-bold text-[#00a854] text-lg">
            {email.sender.displayName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold text-sm text-gray-800">
                {email.sender.displayName} <span className="font-normal text-xs text-gray-400">&lt;{email.sender.email}&gt;</span>
              </h3>
              <span className="text-xs text-gray-400">
                {formatDate(email.sentAt || email.scheduledAt)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">to: {email.recipient}</p>
          </div>
        </div>

        {/* Email Body Message */}
        <div className="prose max-w-none text-gray-700 text-sm whitespace-pre-wrap leading-relaxed mb-12">
          {email.body}
        </div>



      </div>
    </div>
  );
}
