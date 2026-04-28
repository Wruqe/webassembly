import { Component, ElementRef, ViewChild, AfterViewInit, viewChild } from '@angular/core';
import * as THREE from 'three';
import { thickness } from 'three/src/nodes/core/PropertyNode.js';
import { lights } from 'three/src/nodes/lighting/LightsNode.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { objectDirection } from 'three/src/nodes/accessors/Object3DNode.js';
import { mat4 } from 'three/src/nodes/tsl/TSLCore.js';
type ConveyerData = {
  mesh: THREE.Mesh;
  axis: 'x' | 'z';
  center: THREE.Vector3;
  start: THREE.Vector3;
  end: THREE.Vector3;
}
@Component({
  selector: 'app-warehouse-scene',
  imports: [],
  templateUrl: './warehouse-scene.html',
  styleUrl: './warehouse-scene.scss',
})
export class WarehouseScene {
  private readonly conveyorHeight = 0.25;
  private readonly conveyorDepth = 1.5;
  private readonly conveyorWidth = 12;
  private readonly railHeight = 0.22;
  private readonly railThickness = 0.08;
  private readonly railColor = 0x3a3a3a;
  @ViewChild('sceneContainer', { static: true })

  container!: ElementRef<HTMLDivElement>;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private width!: number;
  private height!: number;
  private binHeight!: number;
  private cube?: THREE.Mesh;
  private controls!: OrbitControls
  private gridSize = 20;
  private cellSize = 1;
  private conveyorStripes: { mesh: THREE.Mesh, axis: 'x' | 'z', speed: number, start: number, end: number }[] = []
  private conveyers: ConveyerData[] = []
  private masterConveyer?: ConveyerData;
  private initCamera(): void {
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);
  };
  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.container.nativeElement.appendChild(this.renderer.domElement);
  };
  private initControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private initScene(): void {
    this.scene = new THREE.Scene;
    this.scene.background = new THREE.Color(0x20252b);
  };
  private initContainer(): void {
    this.width = this.container.nativeElement.clientWidth;
    this.height = this.container.nativeElement.clientHeight;
  }
  private initCube(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.cube.position.y = 0.5;
    this.scene.add(this.cube);
  }
  private initFloor(): void {
    const geometry = new THREE.PlaneGeometry(20, 20);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = Math.PI / 2;
    this.scene.add(floor);
  }

  private initLight(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);

    this.scene.add(directionalLight);
  }


  private createShelf(x: number, z: number) {
    const geometry = new THREE.BoxGeometry(2, 3, 1,);
    const material = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const shelf = new THREE.Mesh(geometry, material);

    shelf.position.set(x, 1.5, z);
    this.scene.add(shelf);
  }

  private createBin(x: number, z: number): THREE.Group {
    const material = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const width = 2;
    const height = 1;
    const depth = 2;
    const thickness = 0.1;

    const bottom = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), material);
    bottom.position.set(x, thickness / 2, z);

    const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), material)
    back.position.set(x, height / 2, z - depth / 2 + thickness / 2);
    const leftwall = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, depth), material);
    leftwall.position.set(x - width / 2 + thickness / 2, height / 2, z);

    const right = new THREE.Mesh(
      new THREE.BoxGeometry(thickness, height, depth),
      material
    );

    right.position.set(
      x + width / 2 - thickness / 2,
      height / 2,
      z
    );
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, thickness),
      material
    );

    front.position.set(
      x,
      height / 2,
      z + depth / 2 - thickness / 2
    );
    const bin = new THREE.Group();
    bin.add(bottom, back, leftwall, right, front);
    this.scene.add(bin);
    return bin;
  }

  private initGrid(): void {
    const divisions = this.gridSize / this.cellSize;

    const grid = new THREE.GridHelper(this.gridSize, divisions);
    this.scene.add(grid);
  }
  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.animateCoveyer();
    this.renderer.render(this.scene, this.camera);
  }
  private initAxesHelper(): void {
    const axes = new THREE.AxesHelper(5)
    this.scene.add(axes);
  }

  private createAmountBins(x: number, z: number, inc: number, conveyor: boolean, dir: 'x' | 'z'): void {
    for (let i = x; i <= z; i += inc) {
      const bin = this.createBin(i, z)
      this.createConveyor(i, z - 7, dir, bin)
    }
  }

  private createGuardRails(
    center: THREE.Vector3,
    axis: 'x' | 'z',
    width: number,
    depth: number,
    beltHeight: number
  ): void {
    const railMaterial = new THREE.MeshStandardMaterial({ color: this.railColor });
    const railY = center.y + beltHeight / 2 + this.railHeight / 2;

    if (axis === 'x') {
      const railGeometry = new THREE.BoxGeometry(width, this.railHeight, this.railThickness);
      const leftRail = new THREE.Mesh(railGeometry, railMaterial);

      leftRail.position.set(center.x, railY, center.z - depth / 2 + this.railThickness / 2);

      this.scene.add(leftRail);
      return;
    }

    const railGeometry = new THREE.BoxGeometry(this.railThickness, this.railHeight, width);
    const leftRail = new THREE.Mesh(railGeometry, railMaterial);
    const rightRail = new THREE.Mesh(railGeometry, railMaterial);

    leftRail.position.set(center.x - depth / 2 + this.railThickness / 2, railY, center.z);
    rightRail.position.set(center.x + depth / 2 - this.railThickness / 2, railY, center.z);

    this.scene.add(leftRail);
    this.scene.add(rightRail);
  }

  private createConveyor(x: number, z: number, axis: 'x' | 'z', binObj: THREE.Group): void {
    const width = this.conveyorWidth;
    const height = this.conveyorHeight;
    const depth = this.conveyorDepth;
    const bin = new THREE.Box3().setFromObject(binObj);
    const binHeight = bin.max.y - bin.min.y;
    this.binHeight = binHeight;
    const y = height / 2 + binHeight;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const conveyer = new THREE.Mesh(geometry, material);

    if (axis === 'z') {
      conveyer.rotation.y = Math.PI / 2;
    }

    conveyer.position.set(x, (height / 2) + binHeight, z);

    let start: THREE.Vector3;
    let end: THREE.Vector3;
    const center = new THREE.Vector3(x, y, z);

    if (axis === 'x') {
      start = new THREE.Vector3(x - width / 2, y, z);
      end = new THREE.Vector3(x + width / 2, y, z);
    } else {
      start = new THREE.Vector3(x, y, z - width / 2);
      end = new THREE.Vector3(x, y, z + width / 2);
    }
    this.scene.add(conveyer);
    this.createGuardRails(center, axis, width, depth, height);
    this.conveyers.push({ mesh: conveyer, axis, center, start, end })

    const stripesGeometry = new THREE.BoxGeometry(.12, 0.02, depth);
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

    for (let offset = -width / 2; offset <= width / 2; offset += 1) {
      const stripe = new THREE.Mesh(stripesGeometry, stripeMaterial);
      if (axis === 'x') {
        stripe.position.set(x + offset, height + 0.02 + binHeight, z);
      } else {
        stripe.rotation.y = Math.PI / 2;
        stripe.position.set(x, height + 0.02 + binHeight, z + offset);
      }
      this.scene.add(stripe);
      this.conveyorStripes.push({
        mesh: stripe,
        axis: axis,
        start: axis === 'x' ? x - width / 2 : z - width / 2,
        end: axis === 'x' ? x + width / 2 : z + width / 2,
        speed: 0.01,
      });
    }
  }

  private animateCoveyer(): void {
    for (const stripe of this.conveyorStripes) {
      if (stripe.axis === 'x') {
        stripe.mesh.position.x += stripe.speed;
        if (stripe.mesh.position.x > stripe.end) {
          stripe.mesh.position.x = stripe.start;
        }
      } else if (stripe.axis === 'z') {
        stripe.mesh.position.z += stripe.speed;
        if (stripe.mesh.position.z > stripe.end) {
          stripe.mesh.position.z = stripe.start;
        }
      }
    }
  }

  private createCurvedConnector(
    centerX: number,
    centerZ: number,
    y: number,
    radius: number,
    direction: 1 | -1
  ): void {
    const beltWidth = 1.35;
    const beltHeight = 0.25;
    const angleStart = -Math.PI / 2;
    const angleEnd = direction === 1 ? 0 : -Math.PI;
    const innerRadius = Math.max(radius - beltWidth / 2, 0.01);
    const outerRadius = radius + beltWidth / 2;
    const material = new THREE.MeshStandardMaterial({
      color: 0x222222,
    });
    const shape = new THREE.Shape();
    const hole = new THREE.Path();

    shape.absarc(0, 0, outerRadius, angleStart, angleEnd, direction === -1);
    shape.absarc(0, 0, innerRadius, angleEnd, angleStart, direction === 1);
    hole.absarc(0, 0, innerRadius, angleStart, angleEnd, direction === -1);
    shape.holes.push(hole);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: beltHeight,
      bevelEnabled: false,
      curveSegments: 48,
      steps: 1,
    });

    geometry.rotateX(Math.PI / 2);
    geometry.translate(centerX, y + beltHeight / 2, centerZ);

    const connector = new THREE.Mesh(geometry, material);
    this.scene.add(connector);
  }
  private createConnectorAtLane(main: ConveyerData, feeder: ConveyerData): void {
    const laneX = feeder.center.x;
    const mainZ = main.center.z;
    const feederEntryZ = feeder.start.z;
    const y = main.center.y;
    const radius = feederEntryZ - mainZ;

    if (radius <= 0) return;

    const direction: 1 | -1 = laneX >= main.center.x ? 1 : -1;
    const centerX = laneX - (direction * radius);
    const centerZ = mainZ + radius;

    this.createCurvedConnector(centerX, centerZ, y, radius, direction);
  }
  private createLongConveyor(
    startX: number,
    endX: number,
    z: number
  ): void {
    const height = this.conveyorHeight;
    const depth = this.conveyorDepth;

    const width = Math.abs(endX - startX);
    const centerX = (startX + endX) / 2;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x222222,
    });

    const conveyor = new THREE.Mesh(geometry, material);
    const y = (height / 2) + this.binHeight;
    const center = new THREE.Vector3(centerX, y, z);
    conveyor.position.copy(center);

    this.scene.add(conveyor);
    this.createGuardRails(center, 'x', width, depth, height);
    this.masterConveyer = {
      mesh: conveyor,
      axis: 'x',
      center,
      start: new THREE.Vector3(startX, y, z),
      end: new THREE.Vector3(endX, y, z),
    };
  }
  private addSwitches(): void {
    const switchWidth = 1.6;
    const switchHeight = 0.18;
    const switchDepth = 0.35;

    const Armgeometry = new THREE.BoxGeometry(
      switchWidth,
      switchHeight,
      switchDepth
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
    });

    for (const conveyer of this.conveyers) {
      const switchArm = new THREE.Mesh(Armgeometry, material);
      const switchPos = conveyer.end.x

      switchArm.position.set(switchPos, conveyer.start.y + 0.1, (this.masterConveyer?.start.z) ? this.masterConveyer.start.z - .5 : 0)
      this.scene.add(switchArm)
    }
  }
  ngAfterViewInit(): void {
    console.log("here is the el", this.container.nativeElement);
    this.initContainer();
    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initControls();
    this.initAxesHelper();
    this.initLight();
    this.initFloor();
    this.initGrid();
    this.createAmountBins(-8, 8, 3, true, 'z');
    this.createLongConveyor(this.conveyers[0].start.x + 1, this.conveyers[this.conveyers.length - 1].end.x + 1, -6)
    if (this.masterConveyer) {
      this.createConnectorAtLane(this.masterConveyer, this.conveyers[0])
    }
    this.addSwitches()
    this.animate();
  }

}
