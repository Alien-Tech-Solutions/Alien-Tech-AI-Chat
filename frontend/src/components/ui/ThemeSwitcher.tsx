import React, { useState } from 'react';
import { useTheme } from './ThemeProvider';
import Button from './Button';
import { ChevronDown, Palette, Monitor, Moon, Sun, Zap, Terminal, Code2 } from 'lucide-react';

interface ThemeSwitcherProps {
  variant?: 'dropdown' | 'tabs' | 'grid';
  size?: 'sm' | 'md' | 'lg';
  showPreview?: boolean;
  className?: string;
}

const themeIcons = {
  light: Sun,
  dark: Moon,
  retro: Zap,
  terminal: Terminal,
  matrix: Code2
};

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  variant = 'dropdown',
  size = 'md',
  showPreview = true,
  className = ''
}) => {
  const { currentTheme, themeId, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-2',
    lg: 'text-lg px-4 py-3'
  };

  if (variant === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="outline"
          size={size}
          className={`${sizeClasses[size]} flex items-center gap-2 min-w-[140px] justify-between
            bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-text)]
            hover:bg-[var(--color-backgroundSecondary)] hover:border-[var(--color-primary)]
            transition-[var(--animation-transition)]`}
        >
          <div className="flex items-center gap-2">
            {React.createElement(themeIcons[themeId as keyof typeof themeIcons] || Palette, {
              className: "w-4 h-4"
            })}
            <span className="capitalize">{currentTheme.name}</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {isOpen && (
          <div className={`absolute top-full left-0 mt-1 w-full min-w-[200px] z-50
            bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg
            backdrop-blur-[var(--effect-blur)] bg-opacity-95
            animate-[var(--animation-fadeIn)]`}
          >
            <div className="p-1">
              {availableThemes.map((theme) => {
                const IconComponent = themeIcons[theme.id as keyof typeof themeIcons] || Palette;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setTheme(theme.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left
                      transition-[var(--animation-transition)]
                      hover:bg-[var(--color-backgroundSecondary)] hover:text-[var(--color-primary)]
                      ${theme.id === themeId 
                        ? 'bg-[var(--color-primary)] text-white' 
                        : 'text-[var(--color-text)]'
                      }`}
                  >
                    <IconComponent className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">{theme.name}</div>
                      {showPreview && (
                        <div className="text-xs text-[var(--color-textMuted)] mt-1">
                          {theme.description}
                        </div>
                      )}
                    </div>
                    {theme.id === themeId && (
                      <div className="w-2 h-2 bg-white rounded-full flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'tabs') {
    return (
      <div className={`flex gap-1 p-1 bg-[var(--color-backgroundSecondary)] rounded-lg ${className}`}>
        {availableThemes.map((theme) => {
          const IconComponent = themeIcons[theme.id as keyof typeof themeIcons] || Palette;
          return (
            <button
              key={theme.id}
              onClick={() => setTheme(theme.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium
                transition-[var(--animation-transition)] ${sizeClasses[size]}
                ${theme.id === themeId
                  ? 'bg-[var(--color-primary)] text-white shadow-md'
                  : 'text-[var(--color-textSecondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)]'
                }`}
              title={theme.description}
            >
              <IconComponent className="w-4 h-4" />
              <span className="hidden sm:inline">{theme.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${className}`}>
        {availableThemes.map((theme) => {
          const IconComponent = themeIcons[theme.id as keyof typeof themeIcons] || Palette;
          return (
            <button
              key={theme.id}
              onClick={() => setTheme(theme.id)}
              className={`p-4 rounded-lg border-2 transition-[var(--animation-transition)]
                hover:scale-105 hover:shadow-lg group
                ${theme.id === themeId
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] bg-opacity-10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
                }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className={`p-3 rounded-full transition-[var(--animation-transition)]
                  ${theme.id === themeId
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-backgroundSecondary)] text-[var(--color-textSecondary)] group-hover:text-[var(--color-primary)]'
                  }`}
                >
                  <IconComponent className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <div className={`font-medium ${sizeClasses[size]}`}>
                    {theme.name}
                  </div>
                  {showPreview && (
                    <div className="text-xs text-[var(--color-textMuted)] mt-1 line-clamp-2">
                      {theme.description}
                    </div>
                  )}
                </div>
                {theme.id === themeId && (
                  <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return null;
};

// Quick theme toggle button (light/dark)
export const QuickThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { themeId, setTheme } = useTheme();
  const isDark = themeId === 'dark';

  return (
    <Button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      variant="ghost"
      size="sm"
      className={`p-2 ${className}`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? (
        <Sun className="w-5 h-5 transition-transform hover:rotate-180" />
      ) : (
        <Moon className="w-5 h-5 transition-transform hover:-rotate-12" />
      )}
    </Button>
  );
};

// System theme detector component
export const SystemThemeButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { setTheme } = useTheme();

  const handleSystemTheme = () => {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDarkMode ? 'dark' : 'light');
  };

  return (
    <Button
      onClick={handleSystemTheme}
      variant="outline"
      size="sm"
      className={`flex items-center gap-2 ${className}`}
      title="Use system theme preference"
    >
      <Monitor className="w-4 h-4" />
      <span className="hidden sm:inline">System</span>
    </Button>
  );
};

export default ThemeSwitcher;
