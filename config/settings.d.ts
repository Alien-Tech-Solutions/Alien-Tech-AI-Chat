import { z } from 'zod';
declare const ConfigSchema: any;
export type AppConfig = z.infer<typeof ConfigSchema>;
/**
 * Get validated configuration
 */
export declare const config: z.infer<any>;
/**
 * Validate that required secrets are set for production
 */
export declare function validateProductionSecrets(): void;
/**
 * Get database path with proper resolution
 */
export declare function getDatabasePath(): string;
/**
 * Check if external API provider is configured
 */
export declare function isExternalProviderConfigured(provider: string): boolean;
export default config;
//# sourceMappingURL=settings.d.ts.map