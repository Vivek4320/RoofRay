'use client';
import { LuCircleHelp, LuFileText, LuInfo, LuMail, LuShieldCheck, LuSparkles } from 'react-icons/lu';

const NAV_ITEMS = [
  {
    href: '#how',
    label: 'How it works',
    icon: (
      <LuSparkles className="h-5 w-5" aria-hidden="true" />
    ),
  },
  {
    href: '#report',
    label: 'Report',
    icon: (
      <LuFileText className="h-5 w-5" aria-hidden="true" />
    ),
  },
  {
    href: '#why',
    label: 'Why Us',
    icon: (
      <LuShieldCheck className="h-5 w-5" aria-hidden="true" />
    ),
  },
  {
    href: '#faq',
    label: 'FAQ',
    icon: (
      <LuCircleHelp className="h-5 w-5" aria-hidden="true" />
    ),
  },
  {
    href: '/about',
    label: 'About',
    icon: (
      <LuInfo className="h-5 w-5" aria-hidden="true" />
    ),
  },
  {
    href: '/contact',
    label: 'Contact',
    icon: (
      <LuMail className="h-5 w-5" aria-hidden="true" />
    ),
  },
];

export default function BottomNav() {
  return (
    <nav aria-label="Mobile bottom navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#070B17]/95 backdrop-blur-xl safe-area-bottom lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="group flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[0.6rem] sm:text-[0.68rem] font-medium text-slate-400 transition-colors duration-200 hover:text-primary active:scale-95"
          >
            <span className="flex h-6 w-6 items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5">
              {item.icon}
            </span>
            <span className="leading-tight">{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
