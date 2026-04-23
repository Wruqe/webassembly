import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WarehouseScene } from './warehouse-scene';

describe('WarehouseScene', () => {
  let component: WarehouseScene;
  let fixture: ComponentFixture<WarehouseScene>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WarehouseScene]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WarehouseScene);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
