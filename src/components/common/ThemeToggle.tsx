import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useAppTheme, ThemePreference } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  variant?: 'button' | 'segmented' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
  isHeroOverlay?: boolean;
}

export default function ThemeToggle({
  className,
  variant = 'button',
  size = 'md',
  isHeroOverlay = false,
}: ThemeToggleProps) {
  const { userPreference, setUserPreference, effectiveTheme, isFestivalEnforced } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDarkMode = effectiveTheme === 'dark' || effectiveTheme === 'night' || effectiveTheme === 'tihar';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = () => {
    if (isFestivalEnforced) return;
    // Direct toggle sequence: Light -> Dark -> System
    if (userPreference === 'light') {
      setUserPreference('dark');
    } else if (userPreference === 'dark') {
      setUserPreference('system');
    } else {
      setUserPreference('light');
    }
  };

  const handleSelectPreference = (pref: ThemePreference) => {
    setUserPreference(pref);
    setIsOpen(false);
  };

  const buttonSizeClasses = {
    sm: 'h-8 px-2 text-xs gap-1.5',
    md: 'h-10 px-2.5 sm:px-3 text-xs gap-1.5',
    lg: 'h-12 px-4 text-sm gap-2',
  }[size];

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-4.5 w-4.5',
  }[size];

  // 1. Segmented control variant (ideal for mobile menu or settings panel)
  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          "inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs",
          className
        )}
        role="group"
        aria-label="Theme mode switcher"
      >
        <button
          type="button"
          onClick={() => handleSelectPreference('light')}
          disabled={isFestivalEnforced}
          aria-pressed={userPreference === 'light'}
          className={cn(
            "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            userPreference === 'light'
              ? "bg-white text-slate-900 shadow-xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
          )}
        >
          <Sun className="h-3.5 w-3.5 text-amber-500" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectPreference('dark')}
          disabled={isFestivalEnforced}
          aria-pressed={userPreference === 'dark'}
          className={cn(
            "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            userPreference === 'dark'
              ? "bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
          )}
        >
          <Moon className="h-3.5 w-3.5 text-cyan-400 dark:text-slate-950" />
          <span>Dark</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectPreference('system')}
          disabled={isFestivalEnforced}
          aria-pressed={userPreference === 'system'}
          className={cn(
            "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            userPreference === 'system'
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
          )}
        >
          <Laptop className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span>Auto</span>
        </button>
      </div>
    );
  }

  // 2. Button with Dropdown option (for header and top bars)
  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        title={`Theme: ${userPreference.toUpperCase()} (${isDarkMode ? 'Dark' : 'Light'}). Click to toggle or right-click for options.`}
        aria-label={`Toggle theme (currently ${userPreference} mode)`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={cn(
          "rounded-full inline-flex items-center justify-center transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2",
          buttonSizeClasses,
          isHeroOverlay
            ? "bg-[#0b101b]/80 hover:bg-slate-800 text-white border border-blue-500/25 backdrop-blur-xl shadow-xs"
            : "text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
        )}
      >
        {userPreference === 'system' ? (
          <Laptop className={cn(iconSizes, "text-indigo-500 dark:text-cyan-400")} />
        ) : isDarkMode ? (
          <Moon className={cn(iconSizes, "text-cyan-400")} />
        ) : (
          <Sun className={cn(iconSizes, "text-amber-500")} />
        )}
        <span className="hidden xl:inline capitalize font-semibold tracking-tight text-xs">
          {userPreference === 'system' ? 'System' : isDarkMode ? 'Dark' : 'Light'}
        </span>
      </button>

      {/* Accessible Dropdown menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50 text-xs font-semibold focus:outline-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
            Appearance
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectPreference('light')}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center justify-between transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer",
              userPreference === 'light' ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-700 dark:text-slate-300"
            )}
          >
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span>Light Mode</span>
            </div>
            {userPreference === 'light' && <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectPreference('dark')}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center justify-between transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer",
              userPreference === 'dark' ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-700 dark:text-slate-300"
            )}
          >
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-cyan-400" />
              <span>Dark Mode</span>
            </div>
            {userPreference === 'dark' && <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelectPreference('system')}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center justify-between transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer",
              userPreference === 'system' ? "text-cyan-600 dark:text-cyan-400 font-bold" : "text-slate-700 dark:text-slate-300"
            )}
          >
            <div className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <span>Match System</span>
            </div>
            {userPreference === 'system' && <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />}
          </button>
        </div>
      )}
    </div>
  );
}
