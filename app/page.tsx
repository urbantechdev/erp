import Script from 'next/script';

export default function HomePage() {
  return (
    <>
      <div id="erp-root">
        <div className="min-h-screen w-full bg-[#0A006E]" aria-hidden="true" />
      </div>
      <Script src="/erp-app.js" strategy="afterInteractive" />
    </>
  );
}
