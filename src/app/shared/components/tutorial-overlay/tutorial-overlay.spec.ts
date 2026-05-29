import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TutorialOverlay } from './tutorial-overlay';

describe('TutorialOverlay', () => {
  let component: TutorialOverlay;
  let fixture: ComponentFixture<TutorialOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TutorialOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorialOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
