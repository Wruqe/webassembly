import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WarehouseScene } from './features/warehouse-scene/warehouse-scene';
@Component({
  selector: 'app-root',
  imports: [WarehouseScene],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected title = 'warehouse-twin';
}
