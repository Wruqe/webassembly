import { Component, ElementRef, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
type ConveyerData = {
  mesh: THREE.Mesh;
  axis: 'x' | 'z';
  center: THREE.Vector3;
  start: THREE.Vector3;
  end: THREE.Vector3;
}
type PackageRoute = {
  colorName: string;
  color: number;
  pairIndex: number;
  side: 'left' | 'right';
  mainTargetX: number;
  mainZ: number;
  feederStartZ: number;
  connectorEntryZ: number;
  arcCenterX: number;
  arcCenterZ: number;
  arcRadius: number;
  laneX: number;
  laneStartZ: number;
  laneEndZ: number;
}
type FeedPackage = {
  mesh: THREE.Mesh;
  route: PackageRoute;
  phase: 'waiting' | 'main' | 'feeder' | 'arc' | 'lane';
  arcAngle: number;
  startX: number;
  endX: number;
  speed: number;
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
  private arcConveyorStripes: {
    mesh: THREE.Mesh;
    centerX: number;
    centerZ: number;
    y: number;
    radius: number;
    angle: number;
    angleStart: number;
    angleEnd: number;
    speed: number;
  }[] = []
  private conveyers: ConveyerData[] = []
  private masterConveyer?: ConveyerData;
  private bucketIndex = 0;
  private readonly bucketConfigs = [
    { name: 'Amber', color: 0xc7954b },
    { name: 'Blue', color: 0x4f8cc9 },
    { name: 'Green', color: 0x6fbf73 },
    { name: 'Red', color: 0xd96c63 },
    { name: 'Purple', color: 0xb48ad8 },
    { name: 'Cyan', color: 0x38bdf8 },
  ];
  private feedPackages: FeedPackage[] = [];
  private packageRoutes: PackageRoute[] = [];
  private packageRouteIndex = 0;
  private packageSpawnTimer = 90;
  private readonly packageSpawnInterval = 90;
  private feederPushers: {
    mesh: THREE.Mesh;
    actuator: THREE.Mesh;
    actuatorBody: THREE.Mesh;
    support: THREE.Mesh;
    pairIndex: number;
    homeZ: number;
    extension: number;
    targetExtension: number;
  }[] = [];
  private connectorSwitches: { mesh: THREE.Mesh; pairIndex: number; rotation: number }[] = [];
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
      color: 0x3f474f,
      metalness: 0.08,
      roughness: 0.78,
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

  private createBucketLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 34;
    const paddingX = 18;
    const paddingY = 10;

    if (!context) {
      return new THREE.Sprite();
    }

    context.font = `700 ${fontSize}px system-ui, sans-serif`;
    const textWidth = context.measureText(text).width;
    canvas.width = Math.ceil(textWidth + paddingX * 2);
    canvas.height = fontSize + paddingY * 2;

    context.font = `700 ${fontSize}px system-ui, sans-serif`;
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(15, 23, 42, 0.88)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#e5f3ff';
    context.fillText(text, paddingX, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
    });
    const label = new THREE.Sprite(material);

    label.scale.set(canvas.width / 95, canvas.height / 95, 1);
    label.renderOrder = 20;
    return label;
  }

  private createBin(x: number, z: number): THREE.Group {
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x52616f,
      metalness: 0.35,
      roughness: 0.42,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fb3c8,
      metalness: 0.6,
      roughness: 0.24,
    });
    const bucketConfig = this.bucketConfigs[this.bucketIndex % this.bucketConfigs.length];
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: bucketConfig.color,
      emissive: 0x0b2f40,
      metalness: 0.2,
      roughness: 0.28,
    });
    const footMaterial = new THREE.MeshStandardMaterial({
      color: 0x242a31,
      metalness: 0.65,
      roughness: 0.32,
    });
    const width = 2;
    const height = 1;
    const depth = 2;
    const thickness = 0.1;

    const bottom = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), panelMaterial);
    bottom.position.set(x, thickness / 2, z);

    const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), panelMaterial)
    back.position.set(x, height / 2, z - depth / 2 + thickness / 2);
    const leftwall = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, depth), panelMaterial);
    leftwall.position.set(x - width / 2 + thickness / 2, height / 2, z);

    const right = new THREE.Mesh(
      new THREE.BoxGeometry(thickness, height, depth),
      panelMaterial
    );

    right.position.set(
      x + width / 2 - thickness / 2,
      height / 2,
      z
    );
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, thickness),
      panelMaterial
    );

    front.position.set(
      x,
      height / 2,
      z + depth / 2 - thickness / 2
    );
    const rim = new THREE.Group();
    const frontRim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, 0.1, 0.12), trimMaterial);
    const backRim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.12, 0.1, 0.12), trimMaterial);
    const leftRim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, depth + 0.12), trimMaterial);
    const rightRim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, depth + 0.12), trimMaterial);

    frontRim.position.set(x, height + 0.05, z + depth / 2);
    backRim.position.set(x, height + 0.05, z - depth / 2);
    leftRim.position.set(x - width / 2, height + 0.05, z);
    rightRim.position.set(x + width / 2, height + 0.05, z);
    rim.add(frontRim, backRim, leftRim, rightRim);

    const accent = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, 0.08, 0.04), accentMaterial);
    accent.position.set(x, height * 0.68, z + depth / 2 + 0.02);

    const feet = new THREE.Group();
    for (const offsetX of [-0.72, 0.72]) {
      for (const offsetZ of [-0.72, 0.72]) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), footMaterial);
        foot.position.set(x + offsetX, 0.08, z + offsetZ);
        feet.add(foot);
      }
    }

    const bin = new THREE.Group();
    bin.add(bottom, back, leftwall, right, front, rim, accent, feet);
    this.scene.add(bin);

    const label = this.createBucketLabel(bucketConfig.name);
    label.position.set(x, height + 0.65, z);
    this.scene.add(label);
    this.bucketIndex += 1;

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
    this.animateArcConveyorStripes();
    this.animateFeedPackage();
    this.animateFeederPushers();
    this.animateConnectorSwitches();
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

  private createConveyorSupports(
    center: THREE.Vector3,
    axis: 'x' | 'z',
    length: number
  ): void {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x343b43,
      metalness: 0.55,
      roughness: 0.34,
    });
    const frameY = center.y - this.conveyorHeight / 2 - 0.08;
    const legHeight = Math.max(frameY, 0.2);
    const legY = legHeight / 2;
    const crossGeometry = axis === 'x'
      ? new THREE.BoxGeometry(length, 0.12, 0.14)
      : new THREE.BoxGeometry(0.14, 0.12, length);
    const leftCross = new THREE.Mesh(crossGeometry, frameMaterial);
    const rightCross = new THREE.Mesh(crossGeometry, frameMaterial);

    if (axis === 'x') {
      leftCross.position.set(center.x, frameY, center.z - this.conveyorDepth / 2 + 0.18);
      rightCross.position.set(center.x, frameY, center.z + this.conveyorDepth / 2 - 0.18);
    } else {
      leftCross.position.set(center.x - this.conveyorDepth / 2 + 0.18, frameY, center.z);
      rightCross.position.set(center.x + this.conveyorDepth / 2 - 0.18, frameY, center.z);
    }

    this.scene.add(leftCross);
    this.scene.add(rightCross);

    const legGeometry = new THREE.BoxGeometry(0.12, legHeight, 0.12);
    const supportCount = Math.max(2, Math.ceil(length / 3));

    for (let i = 0; i < supportCount; i++) {
      const t = supportCount === 1 ? 0.5 : i / (supportCount - 1);
      const along = -length / 2 + length * t;

      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(legGeometry, frameMaterial);

        if (axis === 'x') {
          leg.position.set(
            center.x + along,
            legY,
            center.z + side * (this.conveyorDepth / 2 - 0.18)
          );
        } else {
          leg.position.set(
            center.x + side * (this.conveyorDepth / 2 - 0.18),
            legY,
            center.z + along
          );
        }

        this.scene.add(leg);
      }
    }
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
    this.createConveyorSupports(center, axis, width);
    this.conveyers.push({ mesh: conveyer, axis, center, start, end })

    this.createConveyorStripes(center, axis, width);
  }

  private createConveyorStripes(
    center: THREE.Vector3,
    axis: 'x' | 'z',
    length: number,
    spacing = 1,
    positiveEndTrim = 0
  ): void {
    const stripesGeometry = new THREE.BoxGeometry(.12, 0.02, this.conveyorDepth);
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const startOffset = -length / 2;
    const endOffset = length / 2 - positiveEndTrim;

    for (let offset = startOffset; offset <= endOffset; offset += spacing) {
      const stripe = new THREE.Mesh(stripesGeometry, stripeMaterial);
      if (axis === 'x') {
        stripe.position.set(center.x + offset, center.y + this.conveyorHeight / 2 + 0.02, center.z);
      } else {
        stripe.rotation.y = Math.PI / 2;
        stripe.position.set(center.x, center.y + this.conveyorHeight / 2 + 0.02, center.z + offset);
      }
      this.scene.add(stripe);
      this.conveyorStripes.push({
        mesh: stripe,
        axis: axis,
        start: axis === 'x' ? center.x + startOffset : center.z + startOffset,
        end: axis === 'x' ? center.x + endOffset : center.z + endOffset,
        speed: 0.01,
      });
    }
  }

  private animateCoveyer(): void {
    for (const stripe of this.conveyorStripes) {
      if (stripe.axis === 'x') {
        stripe.mesh.position.x += stripe.speed;
        if (stripe.mesh.position.x > stripe.end) {
          stripe.mesh.position.x = stripe.start + (stripe.mesh.position.x - stripe.end);
        }
      } else if (stripe.axis === 'z') {
        stripe.mesh.position.z += stripe.speed;
        if (stripe.mesh.position.z > stripe.end) {
          stripe.mesh.position.z = stripe.start + (stripe.mesh.position.z - stripe.end);
        }
      }
    }
  }

  private animateArcConveyorStripes(): void {
    for (const stripe of this.arcConveyorStripes) {
      stripe.angle += stripe.speed;

      if (stripe.speed >= 0 && stripe.angle > stripe.angleEnd) {
        stripe.angle = stripe.angleStart + (stripe.angle - stripe.angleEnd);
      } else if (stripe.speed < 0 && stripe.angle < stripe.angleStart) {
        stripe.angle = stripe.angleEnd - (stripe.angleStart - stripe.angle);
      }

      const tangentAngle = stripe.angle + Math.PI / 2;

      stripe.mesh.position.set(
        stripe.centerX + Math.cos(stripe.angle) * stripe.radius,
        stripe.y,
        stripe.centerZ + Math.sin(stripe.angle) * stripe.radius
      );
      stripe.mesh.rotation.y = -tangentAngle;
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
    this.createConveyorSupports(center, 'x', width);
    this.masterConveyer = {
      mesh: conveyor,
      axis: 'x',
      center,
      start: new THREE.Vector3(startX, y, z),
      end: new THREE.Vector3(endX, y, z),
    };
  }

  private createFeedConveyor(
    center: THREE.Vector3,
    axis: 'x' | 'z',
    length: number,
    stripePositiveEndTrim = 0,
    stripeSpacing = 1
  ): void {
    const geometry = new THREE.BoxGeometry(length, this.conveyorHeight, this.conveyorDepth);
    const material = new THREE.MeshStandardMaterial({ color: 0x1f2327 });
    const conveyor = new THREE.Mesh(geometry, material);

    if (axis === 'z') {
      conveyor.rotation.y = Math.PI / 2;
    }

    conveyor.position.copy(center);
    this.scene.add(conveyor);
    this.createGuardRails(center, axis, length, this.conveyorDepth, this.conveyorHeight);
    this.createConveyorSupports(center, axis, length);
    this.createConveyorStripes(
      center,
      axis,
      length,
      stripeSpacing,
      stripePositiveEndTrim
    );
  }

  private createFeedPackages(
    startX: number,
    endX: number,
    y: number,
    z: number,
    routes: PackageRoute[]
  ): void {
    this.packageRoutes = routes;
    const poolSize = routes.length * 2;

    for (let index = 0; index < poolSize; index += 1) {
      const route = routes[index % routes.length];
      const packageGeometry = new THREE.BoxGeometry(0.7, 0.45, 0.55);
      const packageMaterial = new THREE.MeshStandardMaterial({
        color: route.color,
        roughness: 0.58,
        metalness: 0.02,
      });
      const packageMesh = new THREE.Mesh(packageGeometry, packageMaterial);

      packageMesh.visible = false;
      packageMesh.position.set(startX, y + this.conveyorHeight / 2 + 0.25, z);
      this.scene.add(packageMesh);

      this.feedPackages.push({
        mesh: packageMesh,
        route,
        phase: 'waiting',
        arcAngle: -Math.PI / 2,
        startX,
        endX,
        speed: 0.018,
      });
    }
  }

  private spawnFeedPackage(): void {
    if (this.packageRoutes.length === 0) return;

    const nextPackage = this.feedPackages.find((feedPackage) => feedPackage.phase === 'waiting');
    if (!nextPackage) return;

    const route = this.packageRoutes[this.packageRouteIndex % this.packageRoutes.length];
    const material = nextPackage.mesh.material;

    if (material instanceof THREE.MeshStandardMaterial) {
      material.color.setHex(route.color);
    }

    nextPackage.route = route;
    nextPackage.phase = 'main';
    nextPackage.arcAngle = -Math.PI / 2;
    nextPackage.mesh.visible = true;
    nextPackage.mesh.position.set(nextPackage.startX, nextPackage.mesh.position.y, route.mainZ);
    this.packageRouteIndex += 1;
  }

  private createFeederPusher(
    pairIndex: number,
    x: number,
    y: number,
    z: number
  ): void {
    const pusherHomeZ = z + 0.42;
    const actuatorY = y + this.conveyorHeight / 2 + 0.2;
    const pusher = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.16, 0.16),
      new THREE.MeshStandardMaterial({
        color: 0xe9eef2,
        metalness: 0.62,
        roughness: 0.22,
      })
    );

    pusher.position.set(x, actuatorY, pusherHomeZ);
    this.scene.add(pusher);

    const actuator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 1, 16),
      new THREE.MeshStandardMaterial({
        color: 0xb8c0c7,
        metalness: 0.88,
        roughness: 0.18,
      })
    );

    actuator.rotation.x = Math.PI / 2;
    actuator.position.set(x, actuatorY, pusherHomeZ - 0.32);
    this.scene.add(actuator);

    const actuatorBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.58, 20),
      new THREE.MeshStandardMaterial({
        color: 0x303841,
        metalness: 0.72,
        roughness: 0.26,
      })
    );
    actuatorBody.rotation.x = Math.PI / 2;
    actuatorBody.position.set(x, actuatorY, pusherHomeZ - 0.62);
    this.scene.add(actuatorBody);

    const mount = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.3, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x252b31,
        metalness: 0.58,
        roughness: 0.32,
      })
    );
    mount.position.set(x, actuatorY, pusherHomeZ - 0.9);
    this.scene.add(mount);

    const supportHeight = Math.max(actuatorY - 0.12, 0.2);
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, supportHeight, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x252b31,
        metalness: 0.58,
        roughness: 0.32,
      })
    );
    support.position.set(x, supportHeight / 2, pusherHomeZ - 0.62);
    this.scene.add(support);

    this.feederPushers.push({
      mesh: pusher,
      actuator,
      actuatorBody,
      support,
      pairIndex,
      homeZ: pusherHomeZ,
      extension: 0,
      targetExtension: 0,
    });
  }

  private animateFeederPushers(): void {
    for (const pusher of this.feederPushers) {
      const active = this.feedPackages.some((feedPackage) => {
        if (feedPackage.route.pairIndex !== pusher.pairIndex) return false;

        const directlyAligned = feedPackage.phase === 'main' &&
          Math.abs(feedPackage.mesh.position.x - feedPackage.route.mainTargetX) < 0.12;
        const justEnteringFeeder = feedPackage.phase === 'feeder' &&
          feedPackage.mesh.position.z < feedPackage.route.feederStartZ + 0.2;

        return directlyAligned || justEnteringFeeder;
      });

      pusher.targetExtension = active ? 0.48 : 0;
      const response = active ? 0.38 : 0.96;
      pusher.extension += (pusher.targetExtension - pusher.extension) * response;

      if (!active && pusher.extension < 0.01) {
        pusher.extension = 0;
      }

      pusher.mesh.position.z = pusher.homeZ + pusher.extension;

      const actuatorLength = 0.38 + pusher.extension;
      pusher.actuator.scale.y = actuatorLength;
      pusher.actuator.position.z = pusher.homeZ - 0.2 + pusher.extension / 2;
    }
  }

private feederPusherCollidesWithPackage(feedPackage: FeedPackage): boolean {
  const pusher = this.feederPushers.find(
    (item) => item.pairIndex === feedPackage.route.pairIndex
  );

  if (!pusher) return false;

  const pusherHalfX = 0.45;
  const pusherHalfZ = 0.08;

  const packageHalfX = 0.35;
  const packageHalfZ = 0.275;

  const gap = 0.02;

  const xDistance = Math.abs(
    pusher.mesh.position.x - feedPackage.mesh.position.x
  );

  const xOverlap = xDistance <= pusherHalfX + packageHalfX;

  const pusherFrontZ = pusher.mesh.position.z + pusherHalfZ;
  const packageBackZ = feedPackage.mesh.position.z - packageHalfZ;

  const touchingOrPast = pusherFrontZ >= packageBackZ - gap;

  return xOverlap && touchingOrPast;
}
private resolveFeederPusherCollision(feedPackage: FeedPackage): void {
  const pusher = this.feederPushers.find(
    (item) => item.pairIndex === feedPackage.route.pairIndex
  );

  if (!pusher) return;

  const pusherBox = new THREE.Box3().setFromObject(pusher.mesh);
  const packageBox = new THREE.Box3().setFromObject(feedPackage.mesh);

  const pusherFrontZ = pusherBox.max.z;
  const packageHalfDepth =
    (packageBox.max.z - packageBox.min.z) / 2;

  const gap = 0.02;

  feedPackage.mesh.position.z =
    pusherFrontZ + packageHalfDepth + gap;

  feedPackage.phase = 'feeder';
}  private animateFeedPackage(): void {
    this.packageSpawnTimer += 1;

    if (this.packageSpawnTimer >= this.packageSpawnInterval) {
      this.spawnFeedPackage();
      this.packageSpawnTimer = 0;
    }

    for (const feedPackage of this.feedPackages) {
      if (feedPackage.phase === 'waiting') continue;

      if (feedPackage.phase === 'main') {
        feedPackage.mesh.position.x += feedPackage.speed;

        if (feedPackage.mesh.position.x >= feedPackage.route.mainTargetX) {
          feedPackage.mesh.position.x = feedPackage.route.mainTargetX;
        }

        if (this.feederPusherCollidesWithPackage(feedPackage)) {
        this.resolveFeederPusherCollision(feedPackage) }
      } else if (feedPackage.phase === 'feeder') {
        feedPackage.mesh.position.z += feedPackage.speed;

        if (feedPackage.mesh.position.z >= feedPackage.route.connectorEntryZ) {
          feedPackage.mesh.position.z = feedPackage.route.connectorEntryZ;

          if (this.connectorSwitchReadyForPackage(feedPackage)) {
            feedPackage.arcAngle = -Math.PI / 2;
            feedPackage.phase = 'arc';
          }
        }
      } else if (feedPackage.phase === 'arc') {
        const targetAngle = feedPackage.route.side === 'left' ? -Math.PI : 0;
        const angleSpeed = feedPackage.route.side === 'left' ? -0.012 : 0.012;

        feedPackage.arcAngle += angleSpeed;

        if (
          (feedPackage.route.side === 'left' && feedPackage.arcAngle <= targetAngle) ||
          (feedPackage.route.side === 'right' && feedPackage.arcAngle >= targetAngle)
        ) {
          feedPackage.arcAngle = targetAngle;
          feedPackage.phase = 'lane';
        }

        feedPackage.mesh.position.x = feedPackage.route.arcCenterX + Math.cos(feedPackage.arcAngle) * feedPackage.route.arcRadius;
        feedPackage.mesh.position.z = feedPackage.route.arcCenterZ + Math.sin(feedPackage.arcAngle) * feedPackage.route.arcRadius;
      } else {
        feedPackage.mesh.position.z += feedPackage.speed;

        if (feedPackage.mesh.position.z >= feedPackage.route.laneEndZ) {
          feedPackage.mesh.visible = false;
          feedPackage.mesh.position.set(feedPackage.startX, feedPackage.mesh.position.y, feedPackage.route.mainZ);
          feedPackage.phase = 'waiting';
          feedPackage.arcAngle = -Math.PI / 2;
        }
      }
    }
  }

  private createMainFeedSystem(): void {
    const sorted = [...this.conveyers].sort(
      (a, b) => a.center.x - b.center.x
    );

    if (sorted.length < 2) return;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const mainFeedZ = Math.min(...sorted.map((conveyor) => conveyor.start.z)) - 5;
    const mainStartX = first.center.x - this.conveyorDepth;
    const mainEndX = last.center.x + this.conveyorDepth;
    const mainLength = Math.abs(mainEndX - mainStartX);
    const mainCenter = new THREE.Vector3(
      (mainStartX + mainEndX) / 2,
      first.center.y,
      mainFeedZ
    );
    const routes: PackageRoute[] = [];

    this.createFeedConveyor(mainCenter, 'x', mainLength);

    for (let index = 0; index < sorted.length - 1; index += 2) {
      const left = sorted[index];
      const right = sorted[index + 1];
      const pairIndex = index / 2;
      const pairCenterX = (left.center.x + right.center.x) / 2;
      const radius = Math.abs(right.center.x - left.center.x) / 2;
      const connectorEntryZ = left.start.z - radius - 0.55;
      const feederStartZ = mainFeedZ + this.conveyorDepth / 2 - 0.25;
      const feederLength = Math.abs(connectorEntryZ - feederStartZ);
      const feederCenter = new THREE.Vector3(
        pairCenterX,
        first.center.y,
        (feederStartZ + connectorEntryZ) / 2
      );

      this.createFeedConveyor(feederCenter, 'z', feederLength, 0.5, 2.4);
      this.createFeederPusher(
        pairIndex,
        pairCenterX,
        first.center.y,
        mainFeedZ - this.conveyorDepth / 2 - 0.16
      );

      for (const side of ['left', 'right'] as const) {
        const bucketConfig = this.bucketConfigs[pairIndex * 2 + (side === 'left' ? 0 : 1)];
        const lane = side === 'left' ? left : right;

        routes.push({
          colorName: bucketConfig.name,
          color: bucketConfig.color,
          pairIndex,
          side,
          mainTargetX: pairCenterX,
          mainZ: mainFeedZ,
          feederStartZ,
          connectorEntryZ,
          arcCenterX: pairCenterX,
          arcCenterZ: left.start.z,
          arcRadius: radius,
          laneX: lane.center.x,
          laneStartZ: lane.start.z,
          laneEndZ: lane.end.z,
        });
      }
    }

    this.createFeedPackages(mainStartX, mainEndX, first.center.y, mainFeedZ, routes);
  }

  private addSwitches(): void {
    const sorted = [...this.conveyers].sort(
      (a, b) => a.center.x - b.center.x
    );

    for (let i = 0; i < sorted.length - 1; i += 2) {
      const c1 = sorted[i];
      const c2 = sorted[i + 1];
      const radius = Math.abs(c2.center.x - c1.center.x) / 2;
      const arcCenterX = (c1.center.x + c2.center.x) / 2;
      const arcCenterZ = c1.start.z;
      const switchX = arcCenterX;
      const switchZ = arcCenterZ - radius + 0.28;
      const switchY = c1.center.y + this.conveyorHeight / 2 + 0.08;
      const bladeGeometry = new THREE.BoxGeometry(1.18, 0.09, 0.18);
      const bladeMaterial = new THREE.MeshStandardMaterial({
        color: 0xe9eef2,
        metalness: 0.55,
        roughness: 0.24,
      });
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x303841,
        metalness: 0.7,
        roughness: 0.28,
      });
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.18, 0.34),
        bodyMaterial
      );
      housing.position.set(switchX, switchY - 0.02, switchZ + 0.5);
      this.scene.add(housing);

      const pivot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.6, 16),
        new THREE.MeshStandardMaterial({
          color: 0xaeb6bf,
          metalness: 0.9,
          roughness: 0.18,
        })
      );
      pivot.rotation.x = Math.PI / 2;
      pivot.position.set(switchX, switchY, switchZ + 0.38);
      this.scene.add(pivot);

      const supportHeight = Math.max(switchY - 0.12, 0.24);
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, supportHeight, 0.14),
        bodyMaterial
      );
      support.position.set(switchX, supportHeight / 2, switchZ + 0.68);
      this.scene.add(support);

      blade.position.set(switchX, switchY, switchZ);
      blade.rotation.y = 0;
      this.scene.add(blade);
      this.connectorSwitches.push({
        mesh: blade,
        pairIndex: i / 2,
        rotation: 0,
      });
    }
  }

  private animateConnectorSwitches(): void {
    for (const connectorSwitch of this.connectorSwitches) {
      const activePackage = this.feedPackages.find((feedPackage) => {
        if (feedPackage.route.pairIndex !== connectorSwitch.pairIndex) return false;

        const switchZ = feedPackage.route.arcCenterZ - feedPackage.route.arcRadius;
        const closeToArc = feedPackage.phase === 'feeder' &&
          feedPackage.mesh.position.z > feedPackage.route.connectorEntryZ - 0.45;
        const stillClearingSwitch = feedPackage.phase === 'arc' &&
          feedPackage.mesh.position.z <= switchZ + 0.28;

        return closeToArc || stillClearingSwitch;
      });
      const targetRotation = !activePackage
        ? 0
        : this.getConnectorSwitchTargetRotation(activePackage.route.side);
      const response = activePackage ? 0.5 : 0.62;

      connectorSwitch.rotation += (targetRotation - connectorSwitch.rotation) * response;
      connectorSwitch.mesh.rotation.y = connectorSwitch.rotation;
    }
  }

  private connectorSwitchReadyForPackage(feedPackage: FeedPackage): boolean {
    const connectorSwitch = this.connectorSwitches.find(
      (item) => item.pairIndex === feedPackage.route.pairIndex
    );

    if (!connectorSwitch) return true;

    const targetRotation = this.getConnectorSwitchTargetRotation(feedPackage.route.side);

    return Math.abs(connectorSwitch.rotation - targetRotation) < 0.08;
  }

  private getConnectorSwitchTargetRotation(side: 'left' | 'right'): number {
    return side === 'left' ? Math.PI / 5 : -Math.PI / 5;
  }

  private createConntectorLane(): void {
    const sorted = [...this.conveyers].sort(
      (a, b) => a.center.x - b.center.x
    );

    for(let i = 0; i < this.conveyers.length; i+=2){
      const c1 = sorted[i];
      const c2 = sorted[i + 1];

      const distance = Math.abs(c2.center.x - c1.center.x);
      const radius = distance / 2;
      const arcCenterX = (c1.center.x + c2.center.x) / 2;
      const arcCenterZ = c1.start.z;
      const angleStart = -Math.PI;
      const angleEnd = 0;
      const lowestZAngle = -Math.PI / 2;
      const minimumOpening = 1;
      const openingAngle = minimumOpening / (2 * radius);

    this.createSmoothArcStrip(
      arcCenterX,
      arcCenterZ,
      c1.center.y,
        radius,
        this.conveyorDepth,
        this.conveyorHeight,
        angleStart,
        angleEnd,
      0x222222
    );
    this.createArcStripes(arcCenterX, arcCenterZ, c1.center.y, radius, angleStart, angleEnd);
    this.createArcSupports(arcCenterX, arcCenterZ, c1.center.y, radius, angleStart, angleEnd);

    for (const side of [-1, 1]) {
        const wallRadius = radius + side * (this.conveyorDepth / 2 - this.railThickness / 2);

        this.createConnectorWallArc(
          arcCenterX,
          arcCenterZ,
          c1.center.y,
          wallRadius,
          angleStart,
          lowestZAngle - openingAngle
        );
        this.createConnectorWallArc(
          arcCenterX,
          arcCenterZ,
          c1.center.y,
          wallRadius,
          lowestZAngle + openingAngle,
          angleEnd
        );
    }

    }
  }

  private createArcStripes(
    centerX: number,
    centerZ: number,
    y: number,
    radius: number,
    angleStart: number,
    angleEnd: number
  ): void {
    const splitAngle = (angleStart + angleEnd) / 2;

    this.createArcStripeSegment(centerX, centerZ, y, radius, angleStart, splitAngle, -0.0065);
    this.createArcStripeSegment(centerX, centerZ, y, radius, splitAngle, angleEnd, 0.0065);
  }

  private createArcStripeSegment(
    centerX: number,
    centerZ: number,
    y: number,
    radius: number,
    angleStart: number,
    angleEnd: number,
    speed: number
  ): void {
    const stripeGeometry = new THREE.BoxGeometry(0.12, 0.02, this.conveyorDepth);
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const arcLength = Math.abs(angleEnd - angleStart) * radius;
    const stripeCount = Math.max(3, Math.floor(arcLength));

    for (let index = 0; index <= stripeCount; index += 1) {
      const t = index / stripeCount;
      const angle = angleStart + (angleEnd - angleStart) * t;
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      const tangentAngle = angle + Math.PI / 2;

      stripe.position.set(
        centerX + Math.cos(angle) * radius,
        y + this.conveyorHeight / 2 + 0.02,
        centerZ + Math.sin(angle) * radius
      );
      stripe.rotation.y = -tangentAngle;

      this.scene.add(stripe);
      this.arcConveyorStripes.push({
        mesh: stripe,
        centerX,
        centerZ,
        y: y + this.conveyorHeight / 2 + 0.02,
        radius,
        angle,
        angleStart,
        angleEnd,
        speed,
      });
    }
  }

  private createSmoothArcStrip(
    centerX: number,
    centerZ: number,
    y: number,
    radius: number,
    width: number,
    height: number,
    angleStart: number,
    angleEnd: number,
    color: number
  ): void {
    const innerRadius = Math.max(radius - width / 2, 0.01);
    const outerRadius = radius + width / 2;
    const shape = new THREE.Shape();
    const material = new THREE.MeshStandardMaterial({ color });

    shape.moveTo(Math.cos(angleStart) * outerRadius, Math.sin(angleStart) * outerRadius);
    shape.absarc(0, 0, outerRadius, angleStart, angleEnd, false);
    shape.lineTo(Math.cos(angleEnd) * innerRadius, Math.sin(angleEnd) * innerRadius);
    shape.absarc(0, 0, innerRadius, angleEnd, angleStart, true);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: 64,
      steps: 1,
    });

    geometry.rotateX(Math.PI / 2);
    geometry.translate(centerX, y + height / 2, centerZ);

    this.scene.add(new THREE.Mesh(geometry, material));
  }

  private createConnectorWallArc(
    centerX: number,
    centerZ: number,
    y: number,
    radius: number,
    angleStart: number,
    angleEnd: number
  ): void {
    if (angleEnd <= angleStart) return;

    this.createSmoothArcStrip(
      centerX,
      centerZ,
      y + this.conveyorHeight / 2,
      radius,
      this.railThickness,
      this.railHeight,
      angleStart,
      angleEnd,
      this.railColor
    );
  }

  private createArcSupports(
    centerX: number,
    centerZ: number,
    y: number,
    radius: number,
    angleStart: number,
    angleEnd: number
  ): void {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x343b43,
      metalness: 0.55,
      roughness: 0.34,
    });
    const frameY = y - this.conveyorHeight / 2 - 0.08;
    const legHeight = Math.max(frameY, 0.2);
    const legY = legHeight / 2;
    const supportAngles = [
      angleStart + Math.PI / 6,
      (angleStart + angleEnd) / 2,
      angleEnd - Math.PI / 6,
    ];

    for (const angle of supportAngles) {
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      const tangentAngle = angle + Math.PI / 2;
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(this.conveyorDepth, 0.12, 0.14),
        frameMaterial
      );
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, legHeight, 0.12),
        frameMaterial
      );

      cross.position.set(x, frameY, z);
      cross.rotation.y = -tangentAngle;
      leg.position.set(x, legY, z);

      this.scene.add(cross);
      this.scene.add(leg);
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
    this.createMainFeedSystem()
    this.addSwitches()
    this.createConntectorLane()
    this.animate();
  }

}
