import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Produit } from './produit';

describe('Produit', () => {
  let component: Produit;
  let fixture: ComponentFixture<Produit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Produit],
    }).compileComponents();

    fixture = TestBed.createComponent(Produit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
