import React, { useState } from 'react';
import { ShoppingCart, Search, ScanLine, Wine, ArrowRight, CheckCircle2 } from 'lucide-react';

interface OnboardingStep {
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const steps: OnboardingStep[] = [
  {
    title: 'Welcome to VAAIRO',
    desc: 'Your premium spirits & beverage hub. Discover authentic brands with ease.',
    icon: <Wine className="w-20 h-20 text-[#FFDE00]" />
  },
  {
    title: 'Smart Search',
    desc: 'Use the central yellow search button for lightning-fast product lookups.',
    icon: <Search className="w-20 h-20 text-[#FFDE00]" />
  },
  {
    title: 'Easy Ordering',
    desc: 'Add bottles to your ticket and place delivery orders with just a few taps.',
    icon: <ShoppingCart className="w-20 h-20 text-[#FFDE00]" />
  },
  {
    title: 'Barcode Scanner',
    desc: 'Use our integrated scanner to check real-time prices and stock.',
    icon: <ScanLine className="w-20 h-20 text-[#FFDE00]" />
  }
];

export const MobileOnboarding = ({ onComplete }: { onComplete: () => void }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[200] bg-[#0A006E] p-6 flex flex-col items-center justify-between text-white font-montserrat animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="p-6 rounded-full bg-white/10 shadow-lg">
          {step.icon}
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-black italic">{step.title}</h2>
          <p className="text-sm text-slate-300 max-w-xs">{step.desc}</p>
        </div>
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === currentStep ? 'bg-[#FFDE00] w-6' : 'bg-white/30'}`} />
          ))}
        </div>
      </div>
      
      <button
        type="button"
        onClick={handleNext}
        className="w-full py-4 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-2xl font-black text-sm transition cursor-pointer flex items-center justify-center gap-2 active:scale-98 shadow-lg"
      >
        {currentStep < steps.length - 1 ? (
          <>Next <ArrowRight className="w-4 h-4" /></>
        ) : (
          <>Start Shopping <CheckCircle2 className="w-4 h-4" /></>
        )}
      </button>
    </div>
  );
};
