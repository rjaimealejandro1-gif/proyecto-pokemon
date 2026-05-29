import { Component, inject, OnInit } from '@angular/core';
import { ResultStore } from '@core/state/result.store';
import { Router, RouterLink } from '@angular/router';
import { NgIf, DecimalPipe, DatePipe, UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [NgIf, DecimalPipe, DatePipe, UpperCasePipe, RouterLink],
  templateUrl: './result.component.html',
  styleUrl: './result.component.css'
})
export class ResultComponent implements OnInit {
  public readonly resultStore = inject(ResultStore);
  private readonly router = inject(Router);

  ngOnInit() {
    const data = this.resultStore.resultData();
    if (!data) {
      // Si no hay datos (ej. recargó la página directamente en /result), volver al hub
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  getDurationMinutes(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  get data() {
    return this.resultStore.resultData();
  }
}
