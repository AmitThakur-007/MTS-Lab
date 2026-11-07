import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Command, Keyboard } from 'lucide-react';

export interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const shortcuts = [
    { key: 'Cmd/Ctrl + K', description: 'Open Command Palette from any page', category: 'Global Navigation' },
    { key: 'Cmd/Ctrl + /', description: 'Open this Keyboard Shortcuts cheat sheet', category: 'Global Navigation' },
    { key: 'Escape', description: 'Close any active modal, dialog, or search drawer', category: 'Global Navigation' },
    { key: '/', description: 'Focus main search bar when not typing in an input', category: 'Search & Filters' },
    { key: 'Cmd/Ctrl + S', description: 'Trigger manual save on forms & notes', category: 'Forms & Editing' },
    { key: '↑ / ↓', description: 'Navigate up and down in command menus & tables', category: 'Selection' },
    { key: 'Enter', description: 'Confirm selection or submit focused action', category: 'Selection' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="bg-slate-900 text-white p-5 sm:p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-black tracking-tight text-white">
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-0.5">
              Speed up your diagnostic and administrative workflows
            </DialogDescription>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-2 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
            >
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {sc.description}
              </span>
              <kbd className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold text-slate-900 dark:text-white shadow-2xs whitespace-nowrap ml-2">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
          Press <kbd className="font-mono font-bold px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">ESC</kbd> to dismiss this modal.
        </div>
      </DialogContent>
    </Dialog>
  );
}
