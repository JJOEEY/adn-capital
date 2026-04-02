import Link from "next/link";
import { MapPin, Phone } from "lucide-react";

/* ── SVG icons cho Zalo & Facebook ── */
function ZaloIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4zm-4.5 28.5H13v-1.8l5.4-7.2H13v-2h6.5v1.8l-5.4 7.2h5.4v2zm7.5 0h-2v-9h2v9zm0-11h-2v-2h2v2zm7.5 11h-2v-5c0-.83-.67-1.5-1.5-1.5S29.5 26.67 29.5 27.5v5h-2v-9h2v1.1c.57-.82 1.5-1.1 2.5-1.1 1.93 0 3.5 1.57 3.5 3.5v5.5z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-neutral-800/60 bg-neutral-950 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">

          {/* ── Left: Info ── */}
          <div className="space-y-2">
            <p className="text-sm font-black text-white tracking-wide">ADN CAPITAL</p>
            <div className="flex items-start gap-1.5 text-xs text-neutral-500">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-neutral-600" />
              <span>62 Hoàng Thế Thiện, Phường An Khánh, Tp. Hồ Chí Minh</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Phone className="w-3.5 h-3.5 flex-shrink-0 text-neutral-600" />
              <a href="tel:0962977179" className="hover:text-white transition-colors">
                0962 977 179
              </a>
            </div>
          </div>

          {/* ── Right: Contact ── */}
          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-600 font-medium">Contact Us</span>

            {/* Zalo */}
            <a
              href="https://zalo.me/0962977179"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Zalo ADN Capital"
              className="w-9 h-9 rounded-xl bg-neutral-800 hover:bg-blue-500/20 border border-neutral-700 hover:border-blue-500/40 flex items-center justify-center transition-all group"
            >
              <ZaloIcon className="w-5 h-5 text-neutral-400 group-hover:text-blue-400 transition-colors" />
            </a>

            {/* Facebook */}
            <a
              href="https://www.facebook.com/adninvestment"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook ADN Capital"
              className="w-9 h-9 rounded-xl bg-neutral-800 hover:bg-blue-600/20 border border-neutral-700 hover:border-blue-600/40 flex items-center justify-center transition-all group"
            >
              <FacebookIcon className="w-4 h-4 text-neutral-400 group-hover:text-blue-500 transition-colors" />
            </a>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-neutral-800/60 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[10px] text-neutral-700">
            © {new Date().getFullYear()} ADN Capital. All rights reserved.
          </p>
          <Link href="/pricing">
            <span className="text-[10px] text-neutral-700 hover:text-emerald-500 transition-colors cursor-pointer">
              Bảng giá dịch vụ
            </span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
