import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Theme, themes, defaultTheme, getTheme } from '../../../themes';

interface ThemeContextType {
  currentTheme: Theme;
  themeId: string;
  setTheme: (themeId: string) => void;
  toggleTheme: () => void;
  availableThemes: Array<{id: string; name: string; description: string}>;
  isLoading: boolean;
  createCustomTheme: (customTheme: Partial<Theme>) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: string;
  persistTheme?: boolean;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
  persistTheme = true
}) => {
  const [themeId, setThemeId] = useState<string>(initialTheme || defaultTheme);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from localStorage on mount
  useEffect(() => {
    if (persistTheme) {
      const savedTheme = localStorage.getItem('lackadaisical-theme');
      if (savedTheme && themes[savedTheme]) {
        setThemeId(savedTheme);
      }
    }
    setIsLoading(false);
  }, [persistTheme]);

  // Apply theme variables to document root
  useEffect(() => {
    const theme = getTheme(themeId);
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove(...Object.keys(themes).map(id => `theme-${id}`));
    
    // Add current theme class
    root.classList.add(`theme-${themeId}`);
    
    // Set CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value as string);
    });
    
    Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--font-size-${key}`, value as string);
    });
    
    Object.entries(theme.typography.fontWeight).forEach(([key, value]) => {
      root.style.setProperty(`--font-weight-${key}`, value as string);
    });
    
    Object.entries(theme.typography.lineHeight).forEach(([key, value]) => {
      root.style.setProperty(`--line-height-${key}`, value as string);
    });
    
    Object.entries(theme.animations).forEach(([key, value]) => {
      root.style.setProperty(`--animation-${key}`, value as string);
    });
    
    Object.entries(theme.effects).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(`--effect-${key}`, value as string);
      }
    });
    
    // Set font families
    root.style.setProperty('--font-family', theme.typography.fontFamily);
    root.style.setProperty('--font-family-mono', theme.typography.fontFamilyMono);
    
    // Handle accessibility preferences
    if (theme.accessibility.reducedMotion) {
      root.style.setProperty('--animation-duration', '0.01ms');
    }
    
    if (theme.accessibility.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    if (theme.accessibility.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }
    
  }, [themeId]);

  const setTheme = (newThemeId: string) => {
    if (themes[newThemeId]) {
      setThemeId(newThemeId);
      
      if (persistTheme) {
        localStorage.setItem('lackadaisical-theme', newThemeId);
      }
      
      // Trigger custom event for theme change
      window.dispatchEvent(new CustomEvent('themeChange', {
        detail: { themeId: newThemeId, theme: getTheme(newThemeId) }
      }));
    }
  };

  const toggleTheme = () => {
    // Simple toggle between light and dark for basic usage
    const newTheme = themeId === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const createCustomTheme = (customTheme: Partial<Theme>) => {
    // Create a custom theme by merging with current theme
    const currentTheme = getTheme(themeId);
    const newTheme: Theme = {
      ...currentTheme,
      ...customTheme,
      id: `custom-${Date.now()}`,
      name: customTheme.name || 'Custom Theme',
      colors: {
        ...currentTheme.colors,
        ...customTheme.colors
      },
      typography: {
        ...currentTheme.typography,
        ...customTheme.typography
      },
      animations: {
        ...currentTheme.animations,
        ...customTheme.animations
      },
      effects: {
        ...currentTheme.effects,
        ...customTheme.effects
      },
      accessibility: {
        ...currentTheme.accessibility,
        ...customTheme.accessibility
      }
    };
    
    // Store custom theme
    const customThemes = JSON.parse(localStorage.getItem('lackadaisical-custom-themes') || '{}');
    customThemes[newTheme.id] = newTheme;
    localStorage.setItem('lackadaisical-custom-themes', JSON.stringify(customThemes));
    
    // Add to themes object
    themes[newTheme.id] = newTheme;
    
    // Apply the new theme
    setTheme(newTheme.id);
  };

  const resetToDefault = () => {
    setTheme(defaultTheme);
  };

  const availableThemes = Object.values(themes).map((theme: Theme) => ({
    id: theme.id,
    name: theme.name,
    description: theme.description
  }));

  const value: ThemeContextType = {
    currentTheme: getTheme(themeId),
    themeId,
    setTheme,
    toggleTheme,
    availableThemes,
    isLoading,
    createCustomTheme,
    resetToDefault
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Higher-order component for theme-aware components
export const withTheme = <P extends object>(
  Component: React.ComponentType<P & { theme: Theme }>
) => {
  return (props: P) => {
    const { currentTheme } = useTheme();
    return <Component {...props} theme={currentTheme} />;
  };
};

// Hook for accessing theme values directly
export const useThemeColors = () => {
  const { currentTheme } = useTheme();
  return currentTheme.colors;
};

export const useThemeTypography = () => {
  const { currentTheme } = useTheme();
  return currentTheme.typography;
};

export const useThemeAnimations = () => {
  const { currentTheme } = useTheme();
  return currentTheme.animations;
};

// Utility hook for responsive theme changes
export const useResponsiveTheme = () => {
  const { setTheme } = useTheme();
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('lackadaisical-theme');
      if (!savedTheme) {
        // Only auto-switch if user hasn't manually set a theme
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setTheme]);
};

export default ThemeProvider;
