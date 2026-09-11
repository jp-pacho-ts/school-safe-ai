import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "School Safe AI",
    template: "%s | School Safe AI",
  },
  description: "Explore School Safe AI, share fictional concerns in our reporting demo, and find guidance for speaking with a trusted adult.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
