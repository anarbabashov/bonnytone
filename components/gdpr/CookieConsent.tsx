"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gdpr-consent";

interface ConsentState {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

/** EU/EEA country codes */
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA
  "IS", "LI", "NO",
  // UK (still follows GDPR-equivalent)
  "GB",
]);

function isEuropeanTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz.startsWith("Europe/");
  } catch {
    return false;
  }
}

async function isEuropeanByIP(): Promise<boolean> {
  try {
    const res = await fetch("https://ip-api.com/json/?fields=countryCode", {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return EU_COUNTRIES.has(data.countryCode);
  } catch {
    return false;
  }
}

function getStoredConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveConsent(consent: ConsentState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
}

export function useConsent(): ConsentState | null {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsent(getStoredConsent());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setConsent(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return consent;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (getStoredConsent()) return;

    // Fast path: OS timezone is European
    if (isEuropeanTimezone()) {
      setVisible(true);
      return;
    }

    // Fallback: check IP geolocation (catches VPN / travel)
    let cancelled = false;
    isEuropeanByIP().then((eu) => {
      if (!cancelled && eu) setVisible(true);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(
    (acceptAll?: boolean) => {
      const consent: ConsentState = {
        essential: true,
        analytics: acceptAll ? true : analytics,
        marketing: acceptAll ? true : marketing,
        timestamp: new Date().toISOString(),
      };
      saveConsent(consent);
      setVisible(false);
    },
    [analytics, marketing],
  );

  const handleDeclineAll = useCallback(() => {
    const consent: ConsentState = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    };
    saveConsent(consent);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <div className="glass mx-auto max-w-2xl rounded-xl p-5 shadow-2xl">
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Cookie Preferences
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          We use cookies to enhance your experience. Essential cookies are
          required for the site to function. You can enable optional cookies
          below.
        </p>

        <div className="mb-4 space-y-3">
          <ToggleRow label="Essential" description="Auth, session, theme" checked disabled />
          <ToggleRow
            label="Analytics"
            description="Usage statistics"
            checked={analytics}
            onChange={setAnalytics}
          />
          <ToggleRow
            label="Marketing"
            description="Personalized ads"
            checked={marketing}
            onChange={setMarketing}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSave(true)}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Accept All
          </button>
          <button
            onClick={() => handleSave()}
            className="glass-subtle rounded-lg px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Save Preferences
          </button>
          <button
            onClick={handleDeclineAll}
            className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Decline All
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <div>
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {description}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </label>
  );
}
