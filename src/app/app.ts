import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogModalComponent } from './shared/components/dialog-modal/dialog-modal.component';
import { DevTelemetryComponent } from './shared/components/dev-telemetry/dev-telemetry.component';
import { TutorialOverlayComponent } from './shared/components/tutorial-overlay/tutorial-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DialogModalComponent, DevTelemetryComponent, TutorialOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('mi_proyecto3p');
}
