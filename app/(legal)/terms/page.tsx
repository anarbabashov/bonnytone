import type { Metadata } from "next";
import Link from "next/link";


export const metadata: Metadata = {
  title: "Terms of Service - BonnyTone Radio",
  description:
    "Terms of Service for BonnyTone Radio. Read the terms and conditions for using our internet radio service.",
};

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground mt-2">Last updated: March 9, 2026</p>
      </header>

      {/* 1. Acceptance of Terms */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          By accessing or using bonnytone.com (&quot;the Service&quot;), operated by Triologic LLC,
          you agree to be bound by these Terms of Service. If you do not agree to these terms, do
          not use the Service.
        </p>
      </section>

      {/* 2. Description of Service */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Description of Service</h2>
        <p className="text-muted-foreground leading-relaxed">
          BonnyTone Radio is a free internet radio station streaming house, deep house, tech house,
          and other electronic music genres. The Service includes optional user accounts for
          personalized features such as mix reminders, favoriting tracks, and DJ following.
        </p>
      </section>

      {/* 3. User Accounts */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. User Accounts</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>You must be at least 13 years of age to create an account</li>
          <li>You must provide accurate and complete information during registration</li>
          <li>You are responsible for maintaining the security of your password</li>
          <li>Multi-factor authentication (MFA) is recommended for account security</li>
          <li>One account per person; duplicate accounts may be removed</li>
          <li>
            You are responsible for all activity that occurs under your account
          </li>
        </ul>
      </section>

      {/* 4. Acceptable Use */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
        <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Attempt unauthorized access to the Service or its systems</li>
          <li>Scrape, data mine, or automatically extract content from the Service</li>
          <li>Interfere with or disrupt the Service or its infrastructure</li>
          <li>Impersonate any person or entity</li>
          <li>Circumvent any security measures implemented by the Service</li>
          <li>Use the Service for any unlawful purpose</li>
        </ul>
      </section>

      {/* 5. Intellectual Property */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Intellectual Property</h2>
        <p className="text-muted-foreground leading-relaxed">
          The BonnyTone Radio name, branding, design, and source code are the property of Triologic
          LLC. You may not reproduce, distribute, or create derivative works from any part of the
          Service without prior written permission.
        </p>
      </section>

      {/* 6. Music & Content Disclaimer */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Music &amp; Content Disclaimer</h2>
        <p className="text-muted-foreground leading-relaxed">
          All music streamed through the Service is the property of the respective artists, labels,
          and rights holders. BonnyTone Radio streams music under applicable licenses and
          authorizations. If you believe any content infringes your copyright, please{" "}
          <Link
            href="/contact"
            className="underline hover:text-foreground transition-colors"
          >
            contact us
          </Link>{" "}
          immediately.
        </p>
      </section>

      {/* 7. Disclaimer of Warranties */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Disclaimer of Warranties</h2>
        <p className="text-muted-foreground leading-relaxed">
          The Service is provided on an &quot;as-is&quot; and &quot;as-available&quot; basis without
          warranties of any kind, either express or implied. We do not guarantee that the Service
          will be uninterrupted, error-free, or secure. Stream quality may vary depending on network
          conditions.
        </p>
      </section>

      {/* 8. Limitation of Liability */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed">
          To the fullest extent permitted by law, Triologic LLC shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages arising from your use of
          the Service. Our total liability for any claim arising from the Service is limited to the
          amount you have paid us, which for a free service is $0.
        </p>
      </section>

      {/* 9. Account Termination */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Account Termination</h2>
        <p className="text-muted-foreground leading-relaxed">
          We reserve the right to suspend or terminate accounts that violate these Terms of Service,
          at our sole discretion and without prior notice. You may delete your account at any time
          through your account settings or by contacting us.
        </p>
      </section>

      {/* 10. Third-Party Links */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. Third-Party Links</h2>
        <p className="text-muted-foreground leading-relaxed">
          The Service may contain links to third-party websites or services. We are not responsible
          for the content, privacy policies, or practices of any third-party sites.
        </p>
      </section>

      {/* 11. Governing Law */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">11. Governing Law</h2>
        <p className="text-muted-foreground leading-relaxed">
          These Terms shall be governed by and construed in accordance with the laws of the State of
          Florida, United States, without regard to its conflict of law provisions. Any disputes
          arising from these Terms or the Service shall be resolved in the courts of Broward County,
          Florida.
        </p>
      </section>

      {/* 12. Changes to Terms */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">12. Changes to Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update these Terms of Service from time to time. The &quot;Last updated&quot; date
          at the top of this page reflects the most recent revision. Your continued use of the
          Service after changes are posted constitutes acceptance of the updated terms.
        </p>
      </section>

      {/* 13. Contact */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">13. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you have any questions about these Terms of Service, please reach out through
          our{" "}
          <Link
            href="/contact"
            className="underline hover:text-foreground transition-colors"
          >
            contact page
          </Link>
          .
        </p>
      </section>

    </article>
  );
}
