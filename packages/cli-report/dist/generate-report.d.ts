import type { AiBridge } from '@ark/ai-bridge';
import type { WeatherData } from './types.js';
export interface ReportResult {
    city: string;
    report: string;
    generatedAt: string;
}
export declare function generateReport(weather: WeatherData, style: string, bridge: AiBridge): Promise<ReportResult>;
//# sourceMappingURL=generate-report.d.ts.map