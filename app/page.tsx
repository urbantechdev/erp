import Script from 'next/script';

export default function HomePage() {
  return (
    <>
      <div id="erp-root">
        <div className="min-h-screen w-full bg-[#0A006E] flex flex-col items-center justify-center text-white p-6">
          <div className="w-16 h-16 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black text-2xl shadow-2xl mb-4">
            V
          </div>
          <h1 className="text-xl font-black tracking-tight text-[#FFDE00] uppercase">
            Vaairo Spirits &amp; Beverage ERP
          </h1>
          <p className="text-xs text-white/75 mt-1 font-medium">
            Loading multi-branch inventory, eTIMS tax engine &amp; POS terminal...
          </p>
        </div>
      </div>
      <Script src="/erp-app.js" strategy="afterInteractive" />
    </>
  );
}
