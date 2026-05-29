import { Component, inject, effect, signal, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TutorialService, TutorialStep } from '../../../core/services/tutorial.service';

@Component({
  selector: 'app-tutorial-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tutorial-overlay.component.html',
  styleUrl: './tutorial-overlay.component.css'
})
export class TutorialOverlayComponent implements OnInit, OnDestroy {
  public tutorialService = inject(TutorialService);

  public spotlightStyle = signal<{ [key: string]: string }>({});
  public typedText = signal<string>('');
  
  private typeInterval: any;
  private resizeObserver: ResizeObserver | null = null;
  private currentTarget: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const step = this.tutorialService.currentStep();
      if (step) {
        this.processStep(step);
      } else {
        this.spotlightStyle.set({});
        this.typedText.set('');
        this.clearTarget();
      }
    });
  }

  ngOnInit() {
    // Listen to resize to re-calculate spotlight if window changes
    window.addEventListener('resize', this.updateSpotlightPosition.bind(this));
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.updateSpotlightPosition.bind(this));
    this.clearTarget();
    if (this.typeInterval) clearInterval(this.typeInterval);
  }

  private processStep(step: TutorialStep) {
    // Reset typing
    if (this.typeInterval) clearInterval(this.typeInterval);
    this.typedText.set('');
    
    let i = 0;
    const fullText = step.text;
    this.typeInterval = setInterval(() => {
      if (i < fullText.length) {
        this.typedText.set(fullText.substring(0, i + 1));
        i++;
      } else {
        clearInterval(this.typeInterval);
      }
    }, 25); // Speed of typing

    // Clear previous observer
    this.clearTarget();

    // Spotlight calculation
    if (step.targetId) {
      // Small delay to allow Angular router to render the new view if it just navigated
      setTimeout(() => {
        const el = document.getElementById(step.targetId!);
        if (el) {
          this.currentTarget = el;
          this.updateSpotlightPosition();
          
          // Use ResizeObserver to track element size changes
          this.resizeObserver = new ResizeObserver(() => {
            this.updateSpotlightPosition();
          });
          this.resizeObserver.observe(el);
          
          // Scroll into view gently so it's visible
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          console.warn('[TutorialOverlay] Target element not found:', step.targetId);
          this.spotlightStyle.set({
            top: '50%',
            left: '50%',
            width: '0px',
            height: '0px'
          });
        }
      }, 300);
    } else {
      this.spotlightStyle.set({
        top: '50%',
        left: '50%',
        width: '0px',
        height: '0px'
      });
    }
  }

  private updateSpotlightPosition() {
    if (!this.currentTarget) return;
    const rect = this.currentTarget.getBoundingClientRect();
    const padding = 10;
    this.spotlightStyle.set({
      top: `${rect.top - padding}px`,
      left: `${rect.left - padding}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`
    });
  }

  private clearTarget() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.currentTarget = null;
  }

  public next() {
    this.tutorialService.nextStep();
  }

  public skip() {
    this.tutorialService.finishTutorial();
  }
}
