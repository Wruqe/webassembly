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
  private bucketIndex = 0;
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
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
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

    const label = this.createBucketLabel(`Bucket ${this.bucketIndex + 1}`);
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
    this.createConveyorSupports(center, 'x', width);
    this.masterConveyer = {
      mesh: conveyor,
      axis: 'x',
      center,
      start: new THREE.Vector3(startX, y, z),
      end: new THREE.Vector3(endX, y, z),
    };
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
      const switchZ = arcCenterZ - radius;
      const switchY = c1.center.y + this.conveyorHeight / 2 + 0.08;
      const bladeGeometry = new THREE.BoxGeometry(1.6, 0.12, 0.28);
      const bladeMaterial = new THREE.MeshStandardMaterial({
        color: 0xe9eef2,
        metalness: 0.55,
        roughness: 0.24,
      });
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);

      blade.position.set(switchX, switchY, switchZ);
      blade.rotation.y = 0;
      this.scene.add(blade)
    }
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
    this.addSwitches()
    this.createConntectorLane()
    this.animate();
  }

}
