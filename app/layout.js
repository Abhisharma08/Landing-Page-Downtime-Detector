import "./globals.css";

export const metadata = {
  title: "Landing Page Downtime Detector",
  description: "Real-time monitoring for Vercel-hosted landing pages."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
