import type { Metadata } from "next";
import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact - BonnyTone Radio",
  description:
    "Get in touch with BonnyTone Radio. Contact us for general inquiries, privacy requests, or business matters.",
};

export default function ContactPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Contact Us</h1>
        <p className="text-muted-foreground mt-2">
          We&apos;d love to hear from you. Fill out the form below and we&apos;ll get back to you
          within 48 hours.
        </p>
      </header>

      <ContactForm />

    </article>
  );
}
