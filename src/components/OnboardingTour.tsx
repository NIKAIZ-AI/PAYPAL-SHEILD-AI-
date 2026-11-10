import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react';
import {
  TOUR_STEPS,
  calculateTourProgress,
  getNextStepIndex,
  getPreviousStepIndex,
  setOnboardingCompleted,
  type TourStep,
} from '../lib/onboarding';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ isOpen, onClose, onNavigateTab }: OnboardingTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const step: TourStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const totalSteps = TOUR_STEPS.length;
  const progressPct = calculateTourProgress(currentStepIndex, totalSteps);
  const isLastStep = currentStepIndex === totalSteps - 1;

  // If the step specifies a target that belongs on the overview tab, switch to it if needed
  useEffect(() => {
    if (!isOpen) return;
    if (step.id !== 'sidebar' && onNavigateTab) {
      onNavigateTab('overview');
    }
  }, [isOpen, step.id, onNavigateTab]);

  // Measure and position the spotlight target
  const updateTargetMeasurements = useCallback(() => {
    if (!isOpen) {
      setTargetRect(null);
      return;
    }

    const selector = step.targetSelector;
    const targetEl = document.querySelector(selector) as HTMLElement | null;

    if (!targetEl) {
      setTargetRect(null);
      setPopoverPos(null);
      return;
    }

    // Scroll element smoothly into view if needed
    const clientRect = targetEl.getBoundingClientRect();
    const isOutOfView =
      clientRect.top < 70 ||
      clientRect.bottom > window.innerHeight - 70 ||
      clientRect.left < 0 ||
      clientRect.right > window.innerWidth;

    if (isOutOfView) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    const updatedRect = targetEl.getBoundingClientRect();
    const padding = 8;
    const measured: TargetRect = {
      top: Math.max(0, updatedRect.top - padding),
      left: Math.max(0, updatedRect.left - padding),
      width: updatedRect.width + padding * 2,
      height: updatedRect.height + padding * 2,
    };
    setTargetRect(measured);

    // Calculate popover position
    const popoverWidth = 420;
    const popoverHeight = 300;
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let computedTop = vh / 2 - popoverHeight / 2;
    let computedLeft = vw / 2 - popoverWidth / 2;

    const preferredPos = step.position || 'bottom';

    if (preferredPos === 'bottom') {
      computedTop = measured.top + measured.height + margin;
      computedLeft = measured.left + measured.width / 2 - popoverWidth / 2;
      // If bottom overflows viewport, flip to top
      if (computedTop + popoverHeight > vh - margin) {
        computedTop = Math.max(margin, measured.top - popoverHeight - margin);
      }
    } else if (preferredPos === 'top') {
      computedTop = measured.top - popoverHeight - margin;
      computedLeft = measured.left + measured.width / 2 - popoverWidth / 2;
      // If top overflows, flip to bottom
      if (computedTop < margin) {
        computedTop = measured.top + measured.height + margin;
      }
    } else if (preferredPos === 'right') {
      computedLeft = measured.left + measured.width + margin;
      computedTop = Math.max(margin, measured.top + measured.height / 2 - popoverHeight / 2);
      // If right overflows, flip to left or bottom
      if (computedLeft + popoverWidth > vw - margin) {
        computedLeft = Math.max(margin, measured.left - popoverWidth - margin);
      }
    } else if (preferredPos === 'left') {
      computedLeft = measured.left - popoverWidth - margin;
      computedTop = Math.max(margin, measured.top + measured.height / 2 - popoverHeight / 2);
      if (computedLeft < margin) {
        computedLeft = measured.left + measured.width + margin;
      }
    }

    // Clamp inside viewport
    computedLeft = Math.max(margin, Math.min(computedLeft, vw - popoverWidth - margin));
    computedTop = Math.max(margin, Math.min(computedTop, vh - popoverHeight - margin));

    setPopoverPos({ top: computedTop, left: computedLeft });
  }, [isOpen, step.targetSelector, step.position]);

  // Update position on step change, resize, scroll
  useLayoutEffect(() => {
    if (!isOpen) return;

    // Small delay to let any tab transition render
    const timer = setTimeout(() => {
      updateTargetMeasurements();
    }, 120);

    const handleWindowChange = () => {
      updateTargetMeasurements();
    };

    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [isOpen, currentStepIndex, updateTargetMeasurements]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => getNextStepIndex(prev, totalSteps));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => getPreviousStepIndex(prev));
  };

  const handleComplete = () => {
    setOnboardingCompleted(true);
    onClose();
  };

  const handleSkip = () => {
    setOnboardingCompleted(true);
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, isLastStep]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Onboarding Tour - ${step.title}`}
      className="fixed inset-0 z-[100] overflow-hidden pointer-events-auto"
    >
      {/* Dark backdrop with cutout for targeted spotlight */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Target Spotlight Highlight Ring */}
      {targetRect && (
        <div
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
          className="absolute z-10 pointer-events-none rounded-2xl border-2 border-sky-400 shadow-[0_0_0_9999px_rgba(7,16,33,0.72),0_0_35px_rgba(56,189,248,0.45)] transition-all duration-300 ease-out"
        >
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-sky-400 rounded-full animate-ping" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-sky-400 rounded-full" />
        </div>
      )}

      {/* Popover Card */}
      <div
        ref={popoverRef}
        style={
          popoverPos
            ? {
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
                width: 'min(420px, calc(100vw - 32px))',
              }
            : {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(420px, calc(100vw - 32px))',
              }
        }
        className="fixed z-20 bg-gradient-to-b from-[#0B172F] via-[#0D1E3D] to-[#071021] text-white rounded-2xl border border-sky-400/35 shadow-[0_20px_50px_rgba(7,16,33,0.85)] p-5 sm:p-6 transition-all duration-300 ease-out"
      >
        {/* Header: Progress, Badge, Close */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-mono font-semibold text-sky-300 uppercase tracking-wider">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              <span className="text-[10px] text-slate-400">PayPal Shield AI Walkthrough</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step.badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                {step.badge}
              </span>
            )}
            <button
              type="button"
              onClick={handleSkip}
              aria-label="Close guided tour"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-1.5 mb-4 overflow-hidden border border-white/5">
          <div
            className="bg-gradient-to-r from-blue-500 to-sky-400 h-1.5 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Content */}
        <div className="space-y-2.5 mb-5">
          <h3 className="font-display font-bold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
            {step.title}
          </h3>
          <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
            {step.description}
          </p>

          {step.highlightText && (
            <div className="mt-3 p-2.5 rounded-xl bg-blue-950/40 border border-sky-400/20 flex items-start gap-2 text-xs text-sky-200">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span className="font-medium text-[11.5px] leading-snug">{step.highlightText}</span>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {/* Step navigation dots */}
            <div className="hidden sm:flex items-center gap-1.5 mr-2" aria-hidden="true">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-4 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                      : 'bg-slate-700 hover:bg-slate-500'
                  }`}
                  aria-label={`Jump to step ${idx + 1}`}
                />
              ))}
            </div>

            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 transition-all flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 shadow-md shadow-blue-500/30 transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95"
            >
              <span>{isLastStep ? 'Get Started' : 'Next'}</span>
              {isLastStep ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Accessibility Keyboard Hint */}
        <div className="mt-3 text-center text-[10px] text-slate-500 font-mono">
          Navigate with ← → keys · Esc to exit
        </div>
      </div>
    </div>
  );
}
