import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Search, 
  User, 
  Smartphone, 
  History,
  Phone,
  Info,
  Home as HomeIcon,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, token } = useAuthStore();
  const isAuthenticated = !!token;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { name: 'Home', path: '/', icon: HomeIcon },
    { name: 'Services', path: '/services', icon: Smartphone },
    { name: 'Track Repair', path: '/track', icon: History },
    { name: 'About', path: '/about', icon: Info },
    { name: 'Contact', path: '/contact', icon: Phone },
  ];

  const socialLinks = [
    {
      name: 'Facebook',
      url: 'https://www.facebook.com/MTSmobilescreenrefurblab/',
      label: 'Visit MTS Lab on Facebook',
      hoverColor: 'hover:bg-[#1877F2] hover:border-[#1877F2] hover:text-white',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
    {
      name: 'Instagram',
      url: 'https://www.instagram.com/mtsmobilescreenrefurblab/?hl=en',
      label: 'Visit MTS Lab on Instagram',
      hoverColor: 'hover:bg-gradient-to-tr hover:from-amber-500 hover:via-pink-600 hover:to-purple-600 hover:border-pink-500 hover:text-white',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
    },
    {
      name: 'TikTok',
      url: 'https://www.tiktok.com/@mtslab',
      label: 'Visit MTS Lab on TikTok',
      hoverColor: 'hover:bg-slate-950 hover:border-slate-950 hover:text-white',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76c-.4 0-.8-.03-1.2-.07z" />
        </svg>
      ),
    },
    {
      name: 'YouTube',
      url: 'https://www.youtube.com/channel/UCmE9DPhJeyhy3UVNL_Iz_1Q',
      label: 'Visit MTS Lab on YouTube',
      hoverColor: 'hover:bg-[#FF0000] hover:border-[#FF0000] hover:text-white',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
    {
      name: 'WhatsApp',
      url: 'https://wa.me/9779869276668',
      label: 'Contact MTS Lab on WhatsApp',
      hoverColor: 'hover:bg-[#25D366] hover:border-[#25D366] hover:text-white',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
    },
  ];

  const glassStyle = isScrolled 
    ? "bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm py-3" 
    : "bg-transparent py-5";

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 sm:px-12",
        glassStyle
      )}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-black/20">
              M
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 hidden sm:block">
              MTS<span className="text-slate-400 font-medium">LAB</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-full border border-slate-200/60 backdrop-blur-md">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link 
                  key={link.name} 
                  to={link.path}
                  className={`text-xs font-extrabold px-4 py-2 rounded-full transition-all ${
                    isActive 
                      ? 'bg-slate-950 text-white shadow-sm' 
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button 
              id="navbar-search-repair-button"
              onClick={() => navigate('/services?focus=search')}
              aria-label="Search Repair Prices"
              className="p-2.5 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
            >
              <Search className="h-4.5 w-4.5" />
            </button>
            
            <div className="hidden sm:flex gap-2">
              {!isAuthenticated ? (
                <Button 
                  onClick={() => navigate('/login')}
                  className="rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs h-10 px-5 shadow-sm cursor-pointer"
                >
                  Staff Portal
                </Button>
              ) : (
                <Button 
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="rounded-full border-slate-300 font-bold text-xs h-10 px-5 shadow-sm cursor-pointer"
                >
                  Dashboard
                </Button>
              )}
            </div>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-full cursor-pointer relative z-[70]"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[55] lg:hidden cursor-pointer"
              aria-hidden="true"
            />

            <motion.div 
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-white/95 backdrop-blur-2xl z-[60] shadow-2xl lg:hidden flex flex-col p-6 sm:p-8 pt-20 sm:pt-24 overflow-y-auto overscroll-contain"
            >
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <Link 
                      key={link.name}
                      to={link.path}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-2xl transition-all group",
                        isActive 
                          ? "bg-slate-900 text-white font-bold shadow-sm" 
                          : "hover:bg-slate-100/80 text-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={cn(
                          "p-2.5 rounded-xl transition-colors",
                          isActive 
                            ? "bg-white/15 text-white" 
                            : "bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white"
                        )}>
                          <link.icon className="h-4.5 w-4.5" />
                        </div>
                        <span className="font-bold text-base">{link.name}</span>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                        isActive ? "text-white/70" : "text-slate-400"
                      )} />
                    </Link>
                  );
                })}
              </div>

              {/* Bottom Actions & Social Media */}
              <div className="mt-6 pt-6 border-t border-slate-200/70 space-y-5">
                {!isAuthenticated ? (
                  <Button 
                    onClick={() => navigate('/login')}
                    className="w-full h-12 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base shadow-sm cursor-pointer"
                  >
                    Login to Account
                  </Button>
                ) : (
                  <Button 
                    onClick={() => navigate('/dashboard')}
                    className="w-full h-12 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base shadow-sm cursor-pointer"
                  >
                    Go to Dashboard
                  </Button>
                )}

                {/* Connect With MTS Lab */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="h-px w-8 bg-slate-200" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">
                      Connect With MTS Lab
                    </p>
                    <span className="h-px w-8 bg-slate-200" />
                  </div>

                  <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                    {socialLinks.map((social) => (
                      <a
                        key={social.name}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        className={cn(
                          "w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-600 flex items-center justify-center transition-all duration-200 shadow-2xs group active:scale-95 cursor-pointer",
                          social.hoverColor
                        )}
                      >
                        <span className="group-hover:scale-110 transition-transform duration-200">
                          {social.icon}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>

                <p className="text-center text-slate-400 text-xs font-medium pt-1">
                  MTS Lab Repair Management System
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

