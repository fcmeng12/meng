type IconProps = { size?: number; className?: string };

function Icon({ children, size = 18, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.7-3.7" /></Icon>;
export const ChevronIcon = (props: IconProps) => <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>;
export const ArrowUpIcon = (props: IconProps) => <Icon {...props}><path d="m18 15-6-6-6 6" /></Icon>;
export const ArrowDownIcon = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>;
export const ActivityIcon = (props: IconProps) => <Icon {...props}><path d="M3 12h4l2.5-7 5 14 2.5-7h4" /></Icon>;
export const ShieldIcon = (props: IconProps) => <Icon {...props}><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Icon>;
export const ClockIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const FilterIcon = (props: IconProps) => <Icon {...props}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>;
export const LayersIcon = (props: IconProps) => <Icon {...props}><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></Icon>;
export const InfoIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>;
