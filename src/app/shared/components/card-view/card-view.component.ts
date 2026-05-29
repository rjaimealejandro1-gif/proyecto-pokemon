import { Component, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card } from '../../../core/models/card.model';
import { CardRarity } from '../../../core/enums/card-rarity.enum';
import { PokemonType } from '../../../core/enums/pokemon-type.enum';

@Component({
  selector: 'app-card-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card-foil-overlay"></div>
    <div class="card-inner">
      <!-- Decoración del Tipo en el marco superior -->
      <div class="card-top-bar">
        <div class="card-name-wrapper">
          <span class="card-name">{{ card.name }}</span>
        </div>
        <div class="card-cost-wrapper">
          <span class="cost-icon">💎</span>
          <span class="cost-value">{{ card.cost || 0 }}</span>
        </div>
      </div>

      <!-- Arte de la carta -->
      <div class="card-art-container">
        <!-- Overlay oscuro sutil de fondo -->
        <div class="art-backdrop"></div>
        <img [src]="card.imageUrl" [alt]="card.name" class="card-art" />
        
        <!-- Insignia del tipo flotante -->
        <div class="type-badge">
          {{ getTypeIcon(card.type) }}
        </div>
      </div>

      <!-- Barra de vida sobre el artwork inferior -->
      <div class="card-mid-bar">
        <div class="hp-badge">
          <span class="hp-icon">❤️</span>
          <span class="hp-values">{{ card.hp }} / {{ card.maxHp }}</span>
        </div>
      </div>

      <!-- Stats de combate en la parte inferior -->
      <div class="card-bottom-bar">
        <div class="stat-box atk-box">
          <span class="stat-icon">⚔️</span>
          <span class="stat-value">{{ card.attack }}</span>
        </div>
        <div class="stat-box def-box">
          <span class="stat-icon">🛡️</span>
          <span class="stat-value">{{ card.defense }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      perspective: 1000px;
      container-type: size;
    }

    /* Contenedor principal de la carta - define su forma y borde exterior */
    :host::before {
      content: '';
      position: absolute;
      top: -2px; left: -2px; right: -2px; bottom: -2px;
      border-radius: 6cqw;
      background: linear-gradient(135deg, #444 0%, #111 50%, #333 100%);
      z-index: 0;
      transition: all 0.3s ease;
    }

    /* Asignar colores de marco basados en el tipo de host mediante CSS vars */
    :host(.type-fire)::before { background: linear-gradient(135deg, #ff7b00 0%, #7a1501 50%, #ff4d00 100%); }
    :host(.type-water)::before { background: linear-gradient(135deg, #00d4ff 0%, #004b75 50%, #00a2ff 100%); }
    :host(.type-grass)::before { background: linear-gradient(135deg, #8aff6b 0%, #174a05 50%, #4caf50 100%); }
    :host(.type-electric)::before { background: linear-gradient(135deg, #ffe600 0%, #6e6000 50%, #ffb703 100%); }
    :host(.type-normal)::before { background: linear-gradient(135deg, #e0e0e0 0%, #555 50%, #999 100%); }

    /* Carta interior */
    .card-inner {
      position: relative;
      width: 100%;
      height: 100%;
      background: #1e1e24;
      border-radius: 5cqw;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: 1;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* Brillo holográfico interactivo */
    .card-foil-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.1) 25%, transparent 30%);
      background-size: 200% 200%;
      z-index: 10;
      border-radius: 5cqw;
      pointer-events: none;
      transition: background-position 0.5s ease;
      background-position: 100% 100%;
      mix-blend-mode: overlay;
    }

    :host:hover .card-foil-overlay {
      background-position: 0% 0%;
    }

    /* Top Bar */
    .card-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3cqw 4cqw;
      background: linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.4));
      border-bottom: 2px solid rgba(255,255,255,0.1);
      position: relative;
      z-index: 2;
    }

    .card-name-wrapper {
      flex: 1;
      overflow: hidden;
    }

    .card-name {
      font-size: 11cqw;
      font-weight: 900;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      white-space: nowrap;
      text-overflow: ellipsis;
      display: block;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    }

    .card-cost-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle, #004b75, #001f33);
      border: 1px solid #00d4ff;
      border-radius: 50%;
      width: 14cqw;
      height: 14cqw;
      box-shadow: 0 0 8px rgba(0,212,255,0.6);
      margin-left: 2cqw;
    }

    .cost-icon { display: none; }
    .cost-value {
      font-size: 8cqw;
      font-weight: 900;
      color: #fff;
      text-shadow: 0 0 5px #00d4ff;
    }

    /* Art Container */
    .card-art-container {
      flex: 1;
      position: relative;
      width: 100%;
      background: radial-gradient(circle at center, #333, #0a0a0c);
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: inset 0 5px 15px rgba(0,0,0,0.6);
      border-bottom: 2px solid rgba(255,255,255,0.1);
    }

    .art-backdrop {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8cGF0aCBkPSJNMCAwbDRsNCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIvPgo8L3N2Zz4=') repeat;
      mix-blend-mode: overlay;
      z-index: 0;
    }

    .card-art {
      width: 90%;
      height: 90%;
      object-fit: contain;
      filter: drop-shadow(0 10px 10px rgba(0,0,0,0.7));
      z-index: 1;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    :host:hover .card-art {
      transform: scale(1.1) translateY(-2cqw);
    }

    .type-badge {
      position: absolute;
      top: 3cqw;
      right: 3cqw;
      width: 12cqw;
      height: 12cqw;
      border-radius: 50%;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.2);
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 7cqw;
      z-index: 2;
    }

    /* Mid Bar (HP) */
    .card-mid-bar {
      position: absolute;
      bottom: 20cqw;
      left: 0;
      right: 0;
      display: flex;
      justify-content: flex-start;
      padding-left: 4cqw;
      z-index: 3;
    }

    .hp-badge {
      background: linear-gradient(90deg, #c9184a, #800f2f);
      padding: 1cqw 3cqw;
      border-radius: 4cqw;
      display: flex;
      align-items: center;
      gap: 1.5cqw;
      border: 1px solid #ff4d6d;
      box-shadow: 0 4px 10px rgba(201,24,74,0.5);
    }

    .hp-icon { font-size: 6cqw; }
    .hp-values {
      font-size: 8cqw;
      font-weight: 900;
      color: white;
      text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
    }

    /* Bottom Bar (Stats) */
    .card-bottom-bar {
      height: 20cqw;
      background: #0a0a0c;
      display: flex;
      justify-content: space-evenly;
      align-items: center;
      padding: 0 2cqw;
      z-index: 2;
      border-top: 1px solid rgba(255,255,255,0.05);
    }

    .stat-box {
      display: flex;
      align-items: center;
      gap: 2cqw;
      background: rgba(255,255,255,0.05);
      padding: 1.5cqw 3cqw;
      border-radius: 3cqw;
      min-width: 40%;
      justify-content: center;
    }

    .atk-box { border-bottom: 2px solid #ffb703; }
    .def-box { border-bottom: 2px solid #48cae4; }

    .stat-icon { font-size: 7cqw; }
    .stat-value {
      font-size: 9cqw;
      font-weight: 900;
      color: white;
    }
  `]
})
export class CardViewComponent {
  @Input({ required: true }) card!: Card;

  @HostBinding('class') get hostClass() {
    return `type-${this.card.type.toLowerCase()}`;
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'FIRE': '🔥',
      'WATER': '💧',
      'GRASS': '🍃',
      'ELECTRIC': '⚡',
      'NORMAL': '⭐',
      'PSYCHIC': '👁️',
      'FIGHTING': '🥊',
      'DARK': '🌑',
      'STEEL': '⚙️',
      'FAIRY': '✨',
      'DRAGON': '🐉'
    };
    return icons[type] || '⚪';
  }
}
