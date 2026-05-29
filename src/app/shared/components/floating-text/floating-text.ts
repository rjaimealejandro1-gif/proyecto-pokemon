import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FloatingTextData {
  id: string;
  text: string;
  type: 'damage' | 'heal' | 'buff' | 'debuff';
  x: number;
  y: number;
}

@Component({
  selector: 'app-floating-text',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="floating-text-container" 
         [style.left.px]="data.x" 
         [style.top.px]="data.y"
         [class]="data.type">
      {{ data.text }}
    </div>
  `,
  styles: [`
    .floating-text-container {
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      font-family: 'Inter', sans-serif;
      font-weight: 900;
      font-size: 28px;
      text-transform: uppercase;
      transform: translate(-50%, -50%);
      animation: floatUp 1.2s cubic-bezier(0.175, 0.885, 0.32, 1) forwards;
      text-shadow: 0 4px 10px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.5);
    }

    .damage {
      color: #ff1744;
      font-size: 36px;
      animation: floatDamage 1s cubic-bezier(0.175, 0.885, 0.32, 1) forwards;
    }

    .heal {
      color: #00e676;
    }

    .buff {
      color: #00b4d8;
    }

    .debuff {
      color: #8338ec;
    }

    @keyframes floatUp {
      0% {
        opacity: 0;
        transform: translate(-50%, 20px) scale(0.5);
      }
      20% {
        opacity: 1;
        transform: translate(-50%, -10px) scale(1.2);
      }
      80% {
        opacity: 1;
        transform: translate(-50%, -40px) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -60px) scale(0.8);
      }
    }

    @keyframes floatDamage {
      0% {
        opacity: 0;
        transform: translate(-50%, 0) scale(0.2) rotate(-5deg);
      }
      20% {
        opacity: 1;
        transform: translate(-50%, -20px) scale(1.5) rotate(5deg);
        text-shadow: 0 0 20px rgba(255, 23, 68, 0.8), 0 0 40px rgba(255, 23, 68, 0.4);
      }
      80% {
        opacity: 1;
        transform: translate(-50%, -40px) scale(1) rotate(0deg);
        text-shadow: 0 4px 10px rgba(0,0,0,0.8);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -60px) scale(0.8);
      }
    }
  `]
})
export class FloatingText {
  @Input({ required: true }) data!: FloatingTextData;
}
