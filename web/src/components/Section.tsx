interface Props {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ label, children, className = "" }: Props) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-3.5 ${className}`}>
      <div className="text-[10px] font-medium tracking-wide uppercase text-gray-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}
