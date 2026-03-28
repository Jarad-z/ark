export interface WeatherData {
    city: string;
    tempC: number;
    feelsLikeC: number;
    humidity: number;
    windKmph: number;
    description: string;
    uvIndex: number;
    visibility: number;
    fetchedAt: string;
}
export declare function fetchWeather(city: string): Promise<WeatherData>;
//# sourceMappingURL=fetch-weather.d.ts.map