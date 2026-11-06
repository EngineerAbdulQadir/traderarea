import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme()
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      className={cn('icon-btn theme-toggle', className)}
      type="button"
      onClick={() => toggleTheme()}
      title={label}
      aria-label={label}
      aria-pressed={isDark}
      data-theme-toggle
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? <Moon size={16} strokeWidth={1.8} /> : <Sun size={16} strokeWidth={1.8} />}
      </span>
    </button>
  )
}
