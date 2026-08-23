import { useState, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, Clock, Upload, X, Bold, Italic, Underline, AlignLeft, List, Quote, ListOrdered } from 'lucide-react';

interface Sender {
  id: string;
  email: string;
  displayName: string;
}

interface ComposeViewProps {
  senders: Sender[];
  onBack: () => void;
  onSchedule: (campaignData: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delayMs: number;
    hourlyLimit: number;
  }) => Promise<boolean>;
}

export default function ComposeView({ senders, onBack, onSchedule }: ComposeViewProps) {
  const [senderId, setSenderId] = useState(senders[0]?.id || '');
  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySec, setDelaySec] = useState('2'); // default 2 seconds between sends
  const [hourlyLimit, setHourlyLimit] = useState('100'); // default 100 per hour
  
  // Date time scheduling state
  const [startTime, setStartTime] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse email list from text/CSV file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Regex to find all valid email patterns
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = text.match(emailRegex) || [];
      const uniqueEmails = Array.from(new Set(foundEmails));
      
      if (uniqueEmails.length > 0) {
        setRecipients(uniqueEmails);
        setToInput(''); // clear manual input
      } else {
        alert("No valid email addresses detected in file. Make sure it contains email addresses.");
      }
    };
    reader.readAsText(file);
  };

  const handleManualAddRecipient = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const email = toInput.trim().replace(/,/g, '');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email)) {
        if (!recipients.includes(email)) {
          setRecipients([...recipients, email]);
        }
        setToInput('');
      }
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipients(recipients.filter((_, i) => i !== indexToRemove));
  };

  const handleSubmit = async () => {
    // Determine the list of recipients: manual entry or uploaded array
    let finalRecipients = [...recipients];
    if (toInput.trim() !== '') {
      const email = toInput.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email) && !finalRecipients.includes(email)) {
        finalRecipients.push(email);
      }
    }

    if (!senderId) {
      alert('Please select a sender profile.');
      return;
    }
    if (finalRecipients.length === 0) {
      alert('Please enter at least one recipient email address or upload a leads file.');
      return;
    }
    if (!subject) {
      alert('Please enter a subject.');
      return;
    }
    if (!body) {
      alert('Please compose your email body.');
      return;
    }

    const delayMs = parseFloat(delaySec) * 1000;
    const limit = parseInt(hourlyLimit);

    const success = await onSchedule({
      senderId,
      subject,
      body,
      recipients: finalRecipients,
      startTime: startTime || undefined,
      delayMs,
      hourlyLimit: limit,
    });

    if (success) {
      onBack(); // Return to dashboard
    }
  };

  // Set date-time presets
  const handlePresetTime = (presetType: 'tomorrow_10am' | 'tomorrow_3pm') => {
    const now = new Date();
    const target = new Date(now);
    target.setDate(now.getDate() + 1); // Tomorrow
    
    if (presetType === 'tomorrow_10am') {
      target.setHours(10, 0, 0, 0);
    } else {
      target.setHours(15, 0, 0, 0);
    }
    
    // Format to yyyy-MM-ddThh:mm for datetime-local input
    const localISO = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    
    setStartTime(localISO);
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
          Compose New Email
        </button>

        {/* Action icons + Send Button */}
        <div className="flex items-center gap-4">

          
          {/* Clock icon / Send later trigger */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`p-2 rounded-xl cursor-pointer transition-all ${
                startTime ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Send Later Popover (Matches Figma styling) */}
            {showDatePicker && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-5">
                <h3 className="font-bold text-sm text-gray-800 mb-3">Send Later</h3>
                
                {/* HTML5 datetime-local picker */}
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-100 rounded-xl outline-none focus:border-green-500 text-sm text-gray-700 mb-4"
                />

                {/* Quick Presets */}
                <div className="space-y-1.5 mb-6">
                  <button
                    onClick={() => handlePresetTime('tomorrow_10am')}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Tomorrow, 10:00 AM
                  </button>
                  <button
                    onClick={() => handlePresetTime('tomorrow_3pm')}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Tomorrow, 3:00 PM
                  </button>
                </div>

                {/* Popover Buttons */}
                <div className="flex justify-end gap-2 border-t border-gray-50 pt-4">
                  <button
                    onClick={() => {
                      setStartTime('');
                      setShowDatePicker(false);
                    }}
                    className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="bg-[#00a854] hover:bg-green-600 text-white px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Action Button */}
          {startTime ? (
            <button
              onClick={handleSubmit}
              className="border border-[#00a854] text-[#00a854] hover:bg-green-50/50 active:bg-green-50 py-2 px-6 rounded-full font-bold text-sm cursor-pointer transition-colors"
            >
              Send Later
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="bg-[#00a854] hover:bg-green-600 active:bg-green-700 text-white py-2 px-6 rounded-full font-bold text-sm cursor-pointer transition-colors"
            >
              Send
            </button>
          )}
        </div>
      </header>

      {/* Form Fields container */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl w-full mx-auto space-y-6">
        
        {/* From select */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-400 w-16">From</span>
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="flex-1 bg-gray-50/50 border border-transparent rounded-xl px-3 py-1.5 outline-none hover:bg-gray-50 focus:bg-white focus:border-green-500 text-sm font-semibold text-gray-700 max-w-xs cursor-pointer"
          >
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} &lt;{s.email}&gt;
              </option>
            ))}
          </select>
        </div>

        {/* To field with CSV/list upload */}
        <div className="flex items-start gap-4 border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-400 w-16 mt-2">To</span>
          <div className="flex-1 flex flex-wrap gap-2 items-center min-h-[38px]">
            {/* Recipient tag chips */}
            {recipients.slice(0, 3).map((email, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-green-50 border border-green-100 text-[#00a854] text-xs font-bold px-2.5 py-1 rounded-full">
                {email}
                <X onClick={() => removeRecipient(i)} className="w-3.5 h-3.5 hover:text-red-500 cursor-pointer" />
              </span>
            ))}
            
            {/* Overload badge */}
            {recipients.length > 3 && (
              <span className="bg-gray-100 border border-gray-200 text-gray-500 text-xs font-bold px-2.5 py-1 rounded-full">
                +{recipients.length - 3}
              </span>
            )}

            {/* Manual entry field */}
            <input
              type="text"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={handleManualAddRecipient}
              placeholder={recipients.length === 0 ? "recipient@example.com (press Enter to add)" : "add more..."}
              className="flex-1 min-w-[200px] py-1 border-none outline-none text-sm text-gray-700 placeholder-gray-300"
            />
          </div>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-green-100 bg-green-50/20 hover:bg-green-50 text-[#00a854] hover:text-green-600 rounded-xl cursor-pointer text-xs font-bold transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload List
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.txt"
            className="hidden"
          />
        </div>

        {/* Subject input */}
        <div className="flex items-center gap-4 border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-400 w-16">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 py-1 border-none outline-none text-sm font-semibold text-gray-800 placeholder-gray-300"
          />
        </div>

        {/* Throttling Inputs */}
        <div className="flex flex-wrap gap-8 py-2">
          {/* Delay between emails */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delay between 2 emails (sec)</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={delaySec}
              onChange={(e) => setDelaySec(e.target.value)}
              className="w-16 px-2.5 py-1.5 bg-gray-50 text-center border border-gray-100 rounded-xl focus:bg-white focus:border-green-500 outline-none text-sm font-semibold text-gray-700"
            />
          </div>

          {/* Hourly limit */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hourly Limit</span>
            <input
              type="number"
              min="1"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              className="w-20 px-2.5 py-1.5 bg-gray-50 text-center border border-gray-100 rounded-xl focus:bg-white focus:border-green-500 outline-none text-sm font-semibold text-gray-700"
            />
          </div>
        </div>

        {/* Text Area and Mock Rich Text Toolbar */}
        <div className="border border-gray-100 rounded-2xl overflow-hidden focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all flex flex-col min-h-[350px]">
          {/* Formatting Bar Mockup */}
          <div className="flex items-center flex-wrap gap-1 p-2 bg-gray-50/50 border-b border-gray-50 select-none">
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><Bold className="w-4 h-4" /></button>
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><Italic className="w-4 h-4" /></button>
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><Underline className="w-4 h-4" /></button>
            <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><AlignLeft className="w-4 h-4" /></button>
            <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><List className="w-4 h-4" /></button>
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><ListOrdered className="w-4 h-4" /></button>
            <button type="button" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"><Quote className="w-4 h-4" /></button>
          </div>

          {/* Text Editor Area */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="flex-1 p-4 outline-none border-none text-sm text-gray-700 placeholder-gray-300 resize-none font-sans leading-relaxed"
          />
        </div>

      </div>
    </div>
  );
}
