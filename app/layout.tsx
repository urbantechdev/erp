import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#0A006E',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Vaairo Spirits & Beverage ERP',
  description:
    'Multi-operational liquor distribution and importer ERP with real-time inventory, geo-regional pricing, regulatory compliance, dual POS, and role-based access control.',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vaairo',
  },
  openGraph: {
    title: 'Vaairo Spirits & Beverage ERP',
    description:
      'Multi-operational liquor distribution and importer ERP with real-time inventory, geo-regional pricing, regulatory compliance, dual POS, and role-based access control.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vaairo Spirits & Beverage ERP',
    description:
      'Multi-operational liquor distribution and importer ERP with real-time inventory, geo-regional pricing, regulatory compliance, dual POS, and role-based access control.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700;1,800&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,800;1,900&family=Raleway:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/erp-app.css" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
