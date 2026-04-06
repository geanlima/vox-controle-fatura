import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'vox_api_base_url';

@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _apiBaseUrl = signal<string>(this.readInitial());
  apiBaseUrl = this._apiBaseUrl.asReadonly();

  setApiBaseUrl(raw: string): void {
    const v = (raw || '').trim().replace(/\/+$/, '');
    this._apiBaseUrl.set(v);
    if (!this.isBrowser) return;
    try {
      if (v) {
        localStorage.setItem(STORAGE_KEY, v);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

  resetToDefault(): void {
    this.setApiBaseUrl('');
  }

  getResolvedApiBaseUrl(): string {
    const configured = this.apiBaseUrl();
    if (configured) return configured;
    return this.getRuntimeDefault();
  }

  private readInitial(): string {
    if (!this.isBrowser) return '';
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return (v || '').trim().replace(/\/+$/, '');
    } catch {
      return '';
    }
  }

  private getRuntimeDefault(): string {
    const w = globalThis as unknown as { __VOX_FINANCE_API_BASE__?: unknown };
    const v = w.__VOX_FINANCE_API_BASE__;
    if (typeof v === 'string' && v.trim()) {
      return v.trim().replace(/\/+$/, '');
    }
    return 'http://localhost:8080/api';
  }
}

