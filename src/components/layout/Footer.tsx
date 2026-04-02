import Link from "next/link";
import { MapPin, Phone } from "lucide-react";

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
              <span>62 Ho&#xE0;ng Th&#x1EBF; Thi&#x1EC7;n, Ph&#x01B0;&#x1EDD;ng An Kh&#xE1;nh, Tp. H&#x1ED3; Ch&#xED; Minh</span>
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
              className="w-10 h-10 rounded-xl overflow-hidden transition-all hover:scale-110 active:scale-95 hover:shadow-lg hover:shadow-blue-500/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/zalo.svg" alt="Zalo" className="w-full h-full" />
            </a>

            {/* Facebook */}
            <a
              href="https://www.facebook.com/adninvestment"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook ADN Capital"
              className="w-10 h-10 rounded-xl overflow-hidden transition-all hover:scale-110 active:scale-95 hover:shadow-lg hover:shadow-blue-600/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/facebook.svg" alt="Facebook" className="w-full h-full" />
            </a>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-neutral-800/60 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[10px] text-neutral-700">
            &copy; {new Date().getFullYear()} ADN Capital. All rights reserved.
          </p>
          <Link href="/pricing">
            <span className="text-[10px] text-neutral-700 hover:text-emerald-500 transition-colors cursor-pointer">
              B&#x1EA3;ng gi&#xE1; d&#x1ECB;ch v&#x1EE5;
            </span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
