import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UiStore {
  // Estado Privado
  private readonly _loading = signal<boolean>(false);
  private readonly _theme = signal<'dark' | 'light'>('dark');
  private readonly _modalActive = signal<string | null>(null);

  // Signals de Solo Lectura Públicas
  public readonly isLoading = computed(() => this._loading());
  public readonly currentTheme = computed(() => this._theme());
  public readonly activeModal = computed(() => this._modalActive());

  // Acciones
  public setLoading(loading: boolean): void {
    this._loading.set(loading);
  }

  public toggleTheme(): void {
    this._theme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  public openModal(modalId: string): void {
    this._modalActive.set(modalId);
  }

  public closeModal(): void {
    this._modalActive.set(null);
  }
}
