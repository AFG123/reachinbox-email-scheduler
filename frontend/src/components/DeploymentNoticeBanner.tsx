import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * DeploymentNoticeBanner
 *
 * Informs visitors that email-sending is disabled on this live deployment
 * due to Render's free-tier SMTP port restrictions, while auth/scheduling/
 * dashboard features remain fully functional.
 */
export default function DeploymentNoticeBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 text-sm">
      <div className="max-w-5xl mx-auto flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
        <p className="flex-1 leading-relaxed">
          <span className="font-semibold">Live demo note:</span> Login,
          scheduling, and the dashboard are fully functional here. Actual
          email delivery is disabled on this deployment because Render's
          free tier blocks outbound SMTP ports — verified working locally
          (see{" "}
          <a
            href="https://github.com/AFG123/reachinbox-email-scheduler#-important-deployment--infrastructure-note"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:text-amber-700"
          >
            README
          </a>{" "}
          for details and demo video).
        </p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notice"
          className="shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
