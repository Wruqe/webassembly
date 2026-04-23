import { Component, ElementRef, ViewChild, AfterViewInit, viewChild } from '@angular/core';
import * as THREE from 'three';
import { lights } from 'three/src/nodes/lighting/LightsNode.js';

@Component({
  selector: 'app-warehouse-scene',
  imports: [],
  templateUrl: './warehouse-scene.html',
  styleUrl: './warehouse-scene.scss',
})
export class WarehouseScene {

@ViewChild('sceneContainer', {static: true})

container!: ElementRef<HTMLDivElement>;
private scene!: THREE.Scene;
private camera!: THREE.PerspectiveCamera;
private renderer!: THREE.WebGLRenderer;
private width!: number;
private height!: number;
private cube!: THREE.Mesh;

private initCamera(): void {
  this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
  this.camera.position.set(5, 5, 5);
  this.camera.lookAt(0, 0,0);
};
private initRenderer():void {
  this.renderer = new THREE.WebGLRenderer({antialias: true});
  this.renderer.setSize(this.width, this.height);
  this.container.nativeElement.appendChild(this.renderer.domElement);
};
private initScene(): void{
  this.scene = new THREE.Scene;
  this.scene.background = new THREE.Color(0x20252b);
};
private initContainer(): void{
  this.width = this.container.nativeElement.clientWidth;
  this.height = this.container.nativeElement.clientHeight;
}
private initCube(): void{
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({color: 0x00ff00});
  this.cube = new THREE.Mesh(geometry, material);
  this.cube.position.y = 0.5;
  this.scene.add(this.cube);
}
private initFloor(): void {
  const geometry = new THREE.PlaneGeometry(10, 10);
  const material = new THREE.MeshStandardMaterial({
    color: 0x888888,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = Math.PI / 2;
  this.scene.add(floor);
}

private initLight(): void{
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  this.scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 5);

this.scene.add(directionalLight);
}


private animate(): void {
requestAnimationFrame(() => this.animate());
this.cube.rotation.y += 0.01;
this.renderer.render(this.scene, this.camera);
}
ngAfterViewInit(): void{
  console.log("here is the el", this.container.nativeElement);
  this.initContainer();
  this.initScene();
  this.initCamera();
  this.initRenderer();
  this.initLight();
  this.initFloor();
  this.initCube();
  this.animate();
  this.renderer.render(this.scene, this.camera);

}

}
