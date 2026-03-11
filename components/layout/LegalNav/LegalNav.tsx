import Link from "next/link";

const pages = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/contact", label: "Contact" },
];

export default function LegalNav({ currentPath }: { currentPath: string }) {
  const otherPages = pages.filter((p) => p.href !== currentPath);

  return (
    <div className="border-t border-border/50 pt-8 mt-12">
      <p className="text-sm font-medium text-muted-foreground mb-3">Related pages</p>
      <div className="flex gap-4">
        {otherPages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {page.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
