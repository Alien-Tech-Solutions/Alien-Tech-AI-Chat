import axios from 'axios';
import { Plugin, PluginContext } from '../../../backend/src/types';

interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
  }>;
}

interface WeatherConfig {
  apiKey?: string;
  defaultLocation?: string;
  units?: 'metric' | 'imperial';
}

class WeatherPlugin implements Plugin {
  name = 'weather';
  version = '1.0.0';
  description = 'Get current weather and forecasts for any location';
  author = 'Lackadaisical Security';
  permissions = ['network', 'location'];
  enabled = true;
  config: WeatherConfig = {};

  private apiKey: string | null = null;
  private defaultLocation = 'New York';
  private units = 'metric';

  async init(config: WeatherConfig): Promise<void> {
    this.config = config;
    this.apiKey = config.apiKey || null;
    this.defaultLocation = config.defaultLocation || 'New York';
    this.units = config.units || 'metric';
  }

  async execute(input: any, context: PluginContext): Promise<any> {
    const { location, type = 'current' } = input;

    if (!this.apiKey) {
      return {
        error: 'Weather API key not configured. Please add OPENWEATHER_API_KEY to your environment variables.',
        suggestion: 'Get a free API key from https://openweathermap.org/api'
      };
    }

    try {
      const targetLocation = location || this.defaultLocation;

      if (type === 'current') {
        return await this.getCurrentWeather(targetLocation);
      } else if (type === 'forecast') {
        return await this.getForecast(targetLocation);
      } else {
        return {
          error: 'Invalid weather type. Use "current" or "forecast"',
          availableTypes: ['current', 'forecast']
        };
      }
    } catch (error) {
      return {
        error: 'Failed to fetch weather data',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getCurrentWeather(location: string): Promise<WeatherData> {
    const url = `https://api.openweathermap.org/data/2.5/weather`;
    const params = {
      q: location,
      appid: this.apiKey,
      units: this.units
    };

    const response = await axios.get(url, { params, timeout: 10000 });
    const data = response.data;

    return {
      location: data.name,
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed),
      feelsLike: Math.round(data.main.feels_like),
      forecast: []
    };
  }

  private async getForecast(location: string): Promise<WeatherData> {
    const url = `https://api.openweathermap.org/data/2.5/forecast`;
    const params = {
      q: location,
      appid: this.apiKey,
      units: this.units,
      cnt: 5 // 5-day forecast
    };

    const response = await axios.get(url, { params, timeout: 10000 });
    const data = response.data;

    // Process forecast data (group by day)
    const dailyForecasts = new Map();
    
    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toDateString();
      if (!dailyForecasts.has(date)) {
        dailyForecasts.set(date, {
          date,
          high: item.main.temp_max,
          low: item.main.temp_min,
          condition: item.weather[0].main
        });
      } else {
        const existing = dailyForecasts.get(date);
        existing.high = Math.max(existing.high, item.main.temp_max);
        existing.low = Math.min(existing.low, item.main.temp_min);
      }
    });

    const forecast = Array.from(dailyForecasts.values()).map((day: any) => ({
      date: day.date,
      high: Math.round(day.high),
      low: Math.round(day.low),
      condition: day.condition
    }));

    return {
      location: data.city.name,
      temperature: Math.round(data.list[0].main.temp),
      condition: data.list[0].weather[0].main,
      humidity: data.list[0].main.humidity,
      windSpeed: Math.round(data.list[0].wind.speed),
      feelsLike: Math.round(data.list[0].main.feels_like),
      forecast
    };
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for this plugin
  }
}

export default new WeatherPlugin(); 