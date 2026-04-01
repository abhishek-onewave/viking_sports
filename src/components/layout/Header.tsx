"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/supabase/auth";

const NAV_LINKS = [
  { label: "About", href: "#about" },
  { label: "Analyzer", href: "#predictor" },
  { label: "History", href: "#dashboard" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-strong shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a
          href="#"
          className="flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-lg tracking-tight"
        >
          <span className="text-viking-gold">VIKING</span>
          <span className="text-viking-snow">SPORTS</span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-viking-steel hover:text-viking-snow transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#predictor"
            className="text-sm font-medium bg-viking-gold/10 text-viking-gold border border-viking-gold/20 rounded-lg px-4 py-2 hover:bg-viking-gold/20 transition-all duration-200"
          >
            Analyze Deal
          </a>

          {/* Auth buttons */}
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-viking-steel">
                    {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="text-xs font-medium text-viking-steel/70 border border-viking-iron/40 rounded-lg px-3 py-1.5 hover:text-viking-snow hover:border-viking-steel/40 transition-all duration-200"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="text-sm font-medium text-viking-snow border border-viking-steel/20 rounded-lg px-4 py-2 hover:bg-viking-snow/5 hover:border-viking-steel/40 transition-all duration-200"
                >
                  Sign In
                </Link>
              )}
            </>
          )}
        </nav>
      </div>
    </motion.header>
  );
}
