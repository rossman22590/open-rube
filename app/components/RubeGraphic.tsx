export function RubeGraphic({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img 
      src="/logo.png" 
      alt="Rube Logo" 
      className={className}
    />
  );
}