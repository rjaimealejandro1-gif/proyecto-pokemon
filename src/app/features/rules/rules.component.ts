import { Component, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor } from '@angular/common';

interface Section {
  id: string;
  title: string;
}

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [RouterLink, NgFor],
  templateUrl: './rules.component.html',
  styleUrl: './rules.component.css'
})
export class RulesComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  sections: Section[] = [
    { id: 'intro', title: '1. INTRODUCCIÓN' },
    { id: 'turn-phases', title: '2. FASES DEL TURNO' },
    { id: 'summoning', title: '3. INVOCACIÓN DE CARTAS' },
    { id: 'combat', title: '4. COMBATE (ATK/DEF)' },
    { id: 'skills', title: '5. HABILIDADES' },
    { id: 'elements', title: '6. MATRIZ ELEMENTAL' },
    { id: 'victory', title: '7. VICTORIA Y DERROTA' },
    { id: 'modes', title: '8. MODOS Y RANKING' },
    { id: 'tips', title: '9. CONSEJOS TÁCTICOS' }
  ];

  activeSection = signal<string>('intro');
  private scrollListener!: EventListener;

  ngAfterViewInit() {
    this.scrollListener = () => this.onScroll();
    this.scrollContainer.nativeElement.addEventListener('scroll', this.scrollListener);
  }

  ngOnDestroy() {
    if (this.scrollContainer && this.scrollListener) {
      this.scrollContainer.nativeElement.removeEventListener('scroll', this.scrollListener);
    }
  }

  scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el && this.scrollContainer) {
      // Calculate position relative to container
      const containerTop = this.scrollContainer.nativeElement.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top;
      const scrollPos = this.scrollContainer.nativeElement.scrollTop + elTop - containerTop - 40; // 40px offset

      this.scrollContainer.nativeElement.scrollTo({
        top: scrollPos,
        behavior: 'smooth'
      });
      this.activeSection.set(id);
    }
  }

  onScroll() {
    const container = this.scrollContainer.nativeElement;
    const scrollPosition = container.scrollTop;
    
    // Find active section based on scroll
    let currentId = this.sections[0].id;
    for (const section of this.sections) {
      const el = document.getElementById(section.id);
      if (el) {
        // Offset de 100px para que detecte un poco antes de llegar arriba
        const offsetTop = el.offsetTop - 100;
        if (scrollPosition >= offsetTop) {
          currentId = section.id;
        }
      }
    }
    this.activeSection.set(currentId);
  }
}
