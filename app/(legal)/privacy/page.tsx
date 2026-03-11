import type { Metadata } from "next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


export const metadata: Metadata = {
  title: "Privacy Policy - BonnyTone Radio",
  description:
    "Privacy Policy for BonnyTone Radio. Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground mt-2">Last updated: March 9, 2026</p>
      </header>

      {/* 1. Introduction */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Introduction</h2>
        <p className="text-muted-foreground leading-relaxed">
          Triologic LLC, doing business as BonnyTone Radio, operates the website bonnytone.com
          (&quot;the Service&quot;). This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you visit our website and use our services.
        </p>
      </section>

      {/* 2. Information We Collect */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Information We Collect</h2>
        <p className="text-muted-foreground leading-relaxed">
          We collect information that you provide directly and information collected automatically:
        </p>
        <h3 className="text-lg font-medium">Account Information</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Email address (required for account creation)</li>
          <li>Display name (optional)</li>
        </ul>
        <h3 className="text-lg font-medium">Passwords</h3>
        <p className="text-muted-foreground leading-relaxed">
          Passwords are hashed using Argon2id before storage. We never store passwords in plaintext
          and cannot retrieve your original password.
        </p>
        <h3 className="text-lg font-medium">Session Data</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>IP address</li>
          <li>User agent (browser and device information)</li>
          <li>Login timestamps</li>
        </ul>
        <h3 className="text-lg font-medium">Audit Logs</h3>
        <p className="text-muted-foreground leading-relaxed">
          All authentication events (login, logout, password changes, MFA enrollment) are logged for
          security purposes.
        </p>
        <h3 className="text-lg font-medium">Login Attempt Tracking</h3>
        <p className="text-muted-foreground leading-relaxed">
          We record login attempts including the email used, IP address, outcome (success/failure),
          and timestamp to detect and prevent unauthorized access.
        </p>
      </section>

      {/* 3. Cookies & Local Storage */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Cookies &amp; Local Storage</h2>
        <p className="text-muted-foreground leading-relaxed">
          We use the following cookies to operate the Service:
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cookie</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Purpose</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-sm">access_token</TableCell>
              <TableCell>10 minutes</TableCell>
              <TableCell>JWT authentication</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">refresh_token</TableCell>
              <TableCell>30 days</TableCell>
              <TableCell>Session continuity</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">session_id</TableCell>
              <TableCell>30 days</TableCell>
              <TableCell>Session identification</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="text-muted-foreground leading-relaxed">
          We also store your theme preference (dark/light mode) in localStorage. This data stays on
          your device and is never transmitted to our servers.
        </p>
      </section>

      {/* 4. How We Use Your Information */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Authenticate your identity and manage your account</li>
          <li>Maintain account security and detect unauthorized access</li>
          <li>
            Send transactional emails (verification, password reset, login alerts)
          </li>
          <li>Improve and maintain the Service</li>
        </ul>
      </section>

      {/* 5. Legal Basis for Processing (GDPR) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Legal Basis for Processing (GDPR)</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you are located in the European Economic Area (EEA), we process your personal data
          under the following legal bases:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>
            <strong className="text-foreground">Consent</strong> &mdash; You voluntarily create an
            account and provide your information
          </li>
          <li>
            <strong className="text-foreground">Contract</strong> &mdash; Processing necessary to
            provide the Service you requested
          </li>
          <li>
            <strong className="text-foreground">Legitimate Interest</strong> &mdash; Security
            monitoring, fraud prevention, and service improvement
          </li>
        </ul>
      </section>

      {/* 6. Third-Party Services */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Third-Party Services</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>
            <strong className="text-foreground">Postmark</strong> &mdash; Email delivery service for
            transactional emails (verification, password reset, login alerts). See their{" "}
            <a
              href="https://postmarkapp.com/eu-privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              privacy policy
            </a>
            .
          </li>
          <li>
            <strong className="text-foreground">AzuraCast</strong> &mdash; Self-hosted radio
            automation software running on our own server. No data is shared externally.
          </li>
          <li>
            <strong className="text-foreground">Google Fonts</strong> &mdash; Loaded via next/font
            at build time. No cookies are set and no tracking occurs at runtime.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          We do not use any advertising networks, analytics services, or third-party tracking tools.
        </p>
      </section>

      {/* 7. Data Retention */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Data Retention</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Sessions: 30 days</li>
          <li>Audit logs: 90 days</li>
          <li>Login attempts: 30 days</li>
          <li>Account data: retained until you request deletion</li>
        </ul>
      </section>

      {/* 8. Your Rights (GDPR) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Your Rights (GDPR)</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you are in the EEA, you have the following rights regarding your personal data:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Right of access</li>
          <li>Right to rectification</li>
          <li>Right to erasure (&quot;right to be forgotten&quot;)</li>
          <li>Right to restrict processing</li>
          <li>Right to data portability</li>
          <li>Right to object to processing</li>
          <li>Right to withdraw consent at any time</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          You also have the right to lodge a complaint with your local data protection supervisory
          authority. To exercise any of these rights, contact us at{" "}
          <a
            href="mailto:bonnytonemusic@gmail.com"
            className="underline hover:text-foreground transition-colors"
          >
            bonnytonemusic@gmail.com
          </a>
          .
        </p>
      </section>

      {/* 9. Your Rights (US) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Your Rights (US)</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you are a California resident, the California Consumer Privacy Act (CCPA) grants you
          the right to know what personal information we collect, request deletion of your data, and
          opt out of the sale of personal information. We do not sell your personal information.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Florida residents have similar rights under applicable Florida privacy law. To exercise
          your rights, contact us at{" "}
          <a
            href="mailto:bonnytonemusic@gmail.com"
            className="underline hover:text-foreground transition-colors"
          >
            bonnytonemusic@gmail.com
          </a>
          .
        </p>
      </section>

      {/* 10. Children's Privacy */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. Children&apos;s Privacy</h2>
        <p className="text-muted-foreground leading-relaxed">
          The Service is not directed to children under 13 years of age. We do not knowingly collect
          personal information from children under 13. If you are under 16, you may only use the
          Service with the consent of a parent or guardian. If we learn we have collected personal
          information from a child under 13, we will delete that information promptly.
        </p>
      </section>

      {/* 11. International Data Transfers */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">11. International Data Transfers</h2>
        <p className="text-muted-foreground leading-relaxed">
          Our server is hosted in the United States (OVHcloud VPS). If you are accessing the Service
          from outside the US, your data will be transferred to and processed in the United States.
          The legal basis for this transfer is your consent and, where applicable, standard
          contractual clauses.
        </p>
      </section>

      {/* 12. Security Measures */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">12. Security Measures</h2>
        <p className="text-muted-foreground leading-relaxed">
          We implement the following security measures to protect your data:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Argon2id password hashing</li>
          <li>Encrypted MFA secrets</li>
          <li>HttpOnly and Secure cookie flags</li>
          <li>CSRF protection</li>
          <li>Rate limiting on authentication endpoints</li>
          <li>Comprehensive audit logging</li>
        </ul>
      </section>

      {/* 13. Changes to This Policy */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">13. Changes to This Policy</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at
          the top of this page reflects the most recent revision. If we make material changes, we
          will notify registered users via email.
        </p>
      </section>

      {/* 14. Contact */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">14. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you have any questions about this Privacy Policy, please reach out through
          our{" "}
          <a
            href="/contact"
            className="underline hover:text-foreground transition-colors"
          >
            contact page
          </a>
          .
        </p>
      </section>

    </article>
  );
}
