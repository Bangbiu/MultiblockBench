import { 
    BufferAttribute, 
    BufferGeometry, 
    DoubleSide, 
    FrontSide, 
    Texture, 
    Vector2, 
    Vector3, 
    type Material 
} from "three";
import type { Coplane } from "../geometry/SubGeometries";
import { Primitives } from "../geometry/Primitives";

class MaterialUtil {
    public static setMaterialOpacity(material: Material | Array<Material>, opacity: number): void {
        const mats = Array.isArray(material) ? material : [material];
        mats.forEach(mat => {
            mat.transparent = (opacity !== 1);
            mat.opacity = opacity;
            mat.side = opacity === 1 ? FrontSide : DoubleSide;  // Optional: see both side
        });
    }

    /**
     * Export texture image of coplanar faces.
     * @param coplane - coplanar face collection
     * @param texture - original texture map from mesh material
     * @param resolution - target resolution (width/height) of output image
     */
    public static exportCoplanarTexture(coplane: Coplane, texture: Texture, resolution = 1024): ImageData {
        const faces = coplane.fetch();
        if (faces.length === 0) throw new Error("Coplane is empty");

        // 1. Construct plane basis
        const baseTri = faces[0].tri();
        const basePlane = coplane.plane;
        const origin = baseTri.a.clone();
        const xAxis = baseTri.b.clone().sub(baseTri.a).normalize();
        const yAxis = basePlane.normal.clone().cross(xAxis).normalize();

        const to2D = (p: Vector3): Vector2 => {
            const v = p.clone().sub(origin);
            return new Vector2(v.dot(xAxis), v.dot(yAxis));
        };

        // 2. Project all triangles into 2D space and collect UVs
        type Face2D = {
            p0: Vector2, p1: Vector2, p2: Vector2,
            uv0: Vector2, uv1: Vector2, uv2: Vector2
        };

        const uvAttr = coplane.parent.src!.attributes.uv as BufferAttribute;
        if (!uvAttr) throw new Error("UV attribute missing");

        const projectedFaces: Face2D[] = [];
        for (const face of faces) {
            const tri = face.tri();
            const [i0, i1, i2] = face.indices();

            projectedFaces.push({
                p0: to2D(tri.a), p1: to2D(tri.b), p2: to2D(tri.c),
                uv0: new Vector2().fromBufferAttribute(uvAttr, i0),
                uv1: new Vector2().fromBufferAttribute(uvAttr, i1),
                uv2: new Vector2().fromBufferAttribute(uvAttr, i2),
            });
        }

        // 3. Normalize 2D projected coords to fit in canvas
        const allPoints = projectedFaces.flatMap(f => [f.p0, f.p1, f.p2]);
        const min = allPoints.reduce((acc, p) => acc.min(p.clone()), allPoints[0].clone());
        const max = allPoints.reduce((acc, p) => acc.max(p.clone()), allPoints[0].clone());
        const size = max.clone().sub(min);
        const scale = resolution / Math.max(size.x, size.y);

        for (const f of projectedFaces) {
            for (const p of [f.p0, f.p1, f.p2]) {
                p.sub(min).multiplyScalar(scale);
            }
        }

        // 4. Create canvas and draw triangles
        const canvas = document.createElement("canvas");
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = texture.image.width;
        srcCanvas.height = texture.image.height;
        srcCanvas.getContext("2d")!.drawImage(texture.image, 0, 0);
        const srcData = srcCanvas.getContext("2d")!.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

        for (const { p0, p1, p2, uv0, uv1, uv2 } of projectedFaces) {
            MaterialUtil.rasterizeTriangleWithUV(
                ctx, p0, p1, p2, uv0, uv1, uv2,
                srcData, srcCanvas.width, srcCanvas.height
            );
        }

        return ctx.getImageData(0, 0, resolution, resolution);
    }

    public static rasterizeTriangleWithUV(
        ctx: CanvasRenderingContext2D,
        p0: Vector2, p1: Vector2, p2: Vector2,
        uv0: Vector2, uv1: Vector2, uv2: Vector2,
        srcData: ImageData, srcW: number, srcH: number
    ) {
        const xmin = Math.floor(Math.min(p0.x, p1.x, p2.x));
        const xmax = Math.ceil(Math.max(p0.x, p1.x, p2.x));
        const ymin = Math.floor(Math.min(p0.y, p1.y, p2.y));
        const ymax = Math.ceil(Math.max(p0.y, p1.y, p2.y));

        const imgData = ctx.getImageData(xmin, ymin, xmax - xmin, ymax - ymin);
        const data = imgData.data;

        const denom = ((p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y));
        if (Math.abs(denom) < 1e-6) return; // degenerate

        for (let y = ymin; y < ymax; y++) {
            for (let x = xmin; x < xmax; x++) {
                const px = x + 0.5, py = y + 0.5;

                const w0 = ((p1.y - p2.y) * (px - p2.x) + (p2.x - p1.x) * (py - p2.y)) / denom;
                const w1 = ((p2.y - p0.y) * (px - p2.x) + (p0.x - p2.x) * (py - p2.y)) / denom;
                const w2 = 1 - w0 - w1;

                if (w0 < 0 || w1 < 0 || w2 < 0) continue;

                const uv = new Vector2()
                    .addScaledVector(uv0, w0)
                    .addScaledVector(uv1, w1)
                    .addScaledVector(uv2, w2);

                const u = Math.min(Math.max(uv.x * srcW, 0), srcW - 1);
                const v = Math.min(Math.max(uv.y * srcH, 0), srcH - 1);
                const sx = Math.floor(u), sy = Math.floor(v);
                const iSrc = (sy * srcW + sx) * 4;
                const r = srcData.data[iSrc];
                const g = srcData.data[iSrc + 1];
                const b = srcData.data[iSrc + 2];
                const a = srcData.data[iSrc + 3];

                const dx = x - xmin;
                const dy = y - ymin;
                const iDst = (dy * (xmax - xmin) + dx) * 4;
                data[iDst] = r;
                data[iDst + 1] = g;
                data[iDst + 2] = b;
                data[iDst + 3] = a;
            }
        }

        ctx.putImageData(imgData, xmin, ymin);
    }

    public static saveImageDataAsPNG(imageData: ImageData, filename = "coplane.png") {
        const canvas = document.createElement("canvas");
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext("2d")!;
        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) return;
            const link = document.createElement("a");
            link.download = filename;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
        }, "image/png");
    }
}

type ExtractOptions = {
  pixelsPerUnit?: number;     // overrides width/height; default 256 px per world unit
  width?: number;             // if provided, image fits this width, height keeps aspect
  height?: number;            // if provided with width, force exact (non-uniform scale)
  padding?: number;           // extra border in pixels (default 4)
  filter?: "nearest" | "bilinear"; // sampling (default "bilinear")
  background?: string | null; // null -> transparent, default null
  flipY?: boolean;            // override texture.flipY when sampling
  pos2dAttrName?: string;     // if your attr name differs from "pos2d"
};

/**
 * Extract a texture patch for a coplanar selection by rasterizing 2D triangles
 * and sampling the source texture via barycentric-interpolated UVs.
 *
 * Returns a Canvas with the baked image.
 */
export function extractCoplaneImage(
    coplane: Coplane,
    texOrMat: Texture | Material,
    opts: ExtractOptions = {}
): ImageData {
  // Resolve texture
  const texture = resolveTexture(texOrMat);
  if (!texture || !texture.image) {
    throw new Error("No valid Texture (material.map) with image provided.");
  }
  const geom = Primitives.coplane(coplane);
  const pos2dName = opts.pos2dAttrName ?? "pos2d";
  const pos2dAttr = geom.getAttribute(pos2dName) as BufferAttribute;
  const uvAttr = geom.getAttribute("uv") as BufferAttribute;
  const idx = geom.index;

  if (!pos2dAttr || pos2dAttr.itemSize !== 2) {
    throw new Error(`Geometry must have a '${pos2dName}' attribute (itemSize=2).`);
  }
  if (!uvAttr || uvAttr.itemSize !== 2) {
    throw new Error("Geometry must have a 'uv' attribute (itemSize=2).");
  }
  if (!idx) {
    throw new Error("Geometry must be indexed (triangles).");
  }

  // Build a readable pixel buffer for the source texture
  const srcCanvas = imageToCanvas(texture.image);
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true })!;
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcPx = srcData.data;
  const flipY = opts.flipY ?? texture.flipY ?? true;

  // Compute bounds of 2D positions
  const bounds = { min: new Vector2(+Infinity, +Infinity), max: new Vector2(-Infinity, -Infinity) };
  for (let i = 0; i < pos2dAttr.count; i++) {
    const x = pos2dAttr.getX(i);
    const y = pos2dAttr.getY(i);
    if (x < bounds.min.x) bounds.min.x = x;
    if (y < bounds.min.y) bounds.min.y = y;
    if (x > bounds.max.x) bounds.max.x = x;
    if (y > bounds.max.y) bounds.max.y = y;
  }
  const size = new Vector2().subVectors(bounds.max, bounds.min);

  // Determine output resolution
  const padding = Math.max(0, Math.floor(opts.padding ?? 4));
  let outW: number, outH: number, scaleX: number, scaleY: number;
  if (opts.pixelsPerUnit) {
    outW = Math.max(1, Math.ceil(size.x * opts.pixelsPerUnit)) + padding * 2;
    outH = Math.max(1, Math.ceil(size.y * opts.pixelsPerUnit)) + padding * 2;
    scaleX = scaleY = opts.pixelsPerUnit;
  } else if (opts.width && opts.height) {
    outW = Math.max(1, Math.floor(opts.width));
    outH = Math.max(1, Math.floor(opts.height));
    scaleX = (outW - padding * 2) / Math.max(1e-8, size.x);
    scaleY = (outH - padding * 2) / Math.max(1e-8, size.y);
  } else {
    const targetW = Math.max(64, Math.floor(opts.width ?? 1024));
    const aspect = size.y > 0 ? size.x / size.y : 1;
    outW = Math.max(1, targetW);
    outH = Math.max(1, Math.floor(outW / Math.max(1e-8, aspect)));
    outW += padding * 2;
    outH += padding * 2;
    scaleX = (outW - padding * 2) / Math.max(1e-8, size.x);
    scaleY = (outH - padding * 2) / Math.max(1e-8, size.y);
  }

  // Prepare output canvas
  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d", { willReadFrequently: true })!;
  if (opts.background) {
    outCtx.fillStyle = opts.background;
    outCtx.fillRect(0, 0, outW, outH);
  } else {
    // Transparent
    outCtx.clearRect(0, 0, outW, outH);
  }
  const outImg = outCtx.createImageData(outW, outH);
  const outPx = outImg.data;
  const writeMask = new Uint8Array(outW * outH); // avoid overdrawing if triangles share edges

  // Triangle rasterization
  const triCount = idx.count / 3;
  const p0 = new Vector2(), p1 = new Vector2(), p2 = new Vector2();
  const t0 = new Vector2(), t1 = new Vector2(), t2 = new Vector2();
  const sample = (opts.filter ?? "bilinear") === "bilinear"
    ? (u: number, v: number) => bilinearSample(srcPx, srcW, srcH, u, v, flipY)
    : (u: number, v: number) => nearestSample(srcPx, srcW, srcH, u, v, flipY);

  for (let tri = 0; tri < triCount; tri++) {
    const i0 = idx.getX(tri * 3 + 0);
    const i1 = idx.getX(tri * 3 + 1);
    const i2 = idx.getX(tri * 3 + 2);

    // 2D positions (plane space) -> raster space
    p0.set(pos2dAttr.getX(i0), pos2dAttr.getY(i0));
    p1.set(pos2dAttr.getX(i1), pos2dAttr.getY(i1));
    p2.set(pos2dAttr.getX(i2), pos2dAttr.getY(i2));

    // Map to pixel coords (origin: top-left)
    const P0 = toPixel(p0, bounds, scaleX, scaleY, padding, outH);
    const P1 = toPixel(p1, bounds, scaleX, scaleY, padding, outH);
    const P2 = toPixel(p2, bounds, scaleX, scaleY, padding, outH);

    // UVs for interpolation
    t0.set(uvAttr.getX(i0), uvAttr.getY(i0));
    t1.set(uvAttr.getX(i1), uvAttr.getY(i1));
    t2.set(uvAttr.getX(i2), uvAttr.getY(i2));

    // Rasterize bounding box of the triangle
    const minX = Math.max(0, Math.floor(Math.min(P0.x, P1.x, P2.x)));
    const maxX = Math.min(outW - 1, Math.ceil(Math.max(P0.x, P1.x, P2.x)));
    const minY = Math.max(0, Math.floor(Math.min(P0.y, P1.y, P2.y)));
    const maxY = Math.min(outH - 1, Math.ceil(Math.max(P0.y, P1.y, P2.y)));

    // Edge function setup for barycentrics in pixel space
    const area = edge(P0, P1, P2);
    if (Math.abs(area) < 1e-6) continue; // degenerate

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p = new Vector2(x + 0.5, y + 0.5);
        const w0 = edge(P1, P2, p);
        const w1 = edge(P2, P0, p);
        const w2 = edge(P0, P1, p);

        // Top-left rule (include pixels on top/left edges for watertightness)
        if (
          w0 < 0 || w1 < 0 || w2 < 0 ||
          (w0 === 0 && !isTopLeft(P1, P2)) ||
          (w1 === 0 && !isTopLeft(P2, P0)) ||
          (w2 === 0 && !isTopLeft(P0, P1))
        ) continue;

        const b0 = w0 / area, b1 = w1 / area, b2 = w2 / area;

        // Interpolate UV by barycentrics
        const u = b0 * t0.x + b1 * t1.x + b2 * t2.x;
        const v = b0 * t0.y + b1 * t1.y + b2 * t2.y;

        const ofs = (y * outW + x);
        if (writeMask[ofs]) continue;
        writeMask[ofs] = 1;

        const rgba = sample(u, v);
        const dst = ofs * 4;
        outPx[dst + 0] = rgba[0];
        outPx[dst + 1] = rgba[1];
        outPx[dst + 2] = rgba[2];
        outPx[dst + 3] = rgba[3];
      }
    }
  }

  return outImg;
}

// ---------- helpers ----------

function resolveTexture(texOrMat: Texture | Material): Texture | null {
  if ((texOrMat as Texture).isTexture) return texOrMat as Texture;
  const mat = texOrMat as any;
  return mat && mat.map && mat.map.isTexture ? (mat.map as Texture) : null;
}

function imageToCanvas(img: CanvasImageSource): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  // ImageBitmap/HTMLImageElement/HTMLCanvasElement supported
  const w = (img as any).width ?? 0;
  const h = (img as any).height ?? 0;
  if (!w || !h) throw new Error("Texture image has invalid dimensions.");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img as any, 0, 0, w, h);
  return canvas;
}

function toPixel(
  p: Vector2,
  bounds: { min: Vector2; max: Vector2 },
  sx: number,
  sy: number,
  pad: number,
  outH: number
) {
  // x: left→right, y: top→bottom (note invert Y to put +Y up in image space)
  const x = (p.x - bounds.min.x) * sx + pad;
  const y = (bounds.max.y - p.y) * sy + pad;
  return new Vector2(x, y);
}

function edge(a: Vector2, b: Vector2, c: Vector2): number {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}
function isTopLeft(a: Vector2, b: Vector2): boolean {
  return (b.y === a.y && b.x < a.x) || b.y < a.y;
}

function nearestSample(
  src: Uint8ClampedArray, w: number, h: number,
  u: number, v: number, flipY: boolean
): [number, number, number, number] {
  let x = Math.round(u * (w - 1));
  let y = Math.round((flipY ? (1 - v) : v) * (h - 1));
  x = clampI(x, 0, w - 1);
  y = clampI(y, 0, h - 1);
  const i = (y * w + x) * 4;
  return [src[i], src[i + 1], src[i + 2], src[i + 3]];
}

function bilinearSample(
  src: Uint8ClampedArray, w: number, h: number,
  u: number, v: number, flipY: boolean
): [number, number, number, number] {
  const fx = u * (w - 1);
  const fy = (flipY ? (1 - v) : v) * (h - 1);
  const x0 = clampI(Math.floor(fx), 0, w - 1);
  const y0 = clampI(Math.floor(fy), 0, h - 1);
  const x1 = clampI(x0 + 1, 0, w - 1);
  const y1 = clampI(y0 + 1, 0, h - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const c00 = px(src, w, x0, y0);
  const c10 = px(src, w, x1, y0);
  const c01 = px(src, w, x0, y1);
  const c11 = px(src, w, x1, y1);

  const top = lerp4(c00, c10, tx);
  const bot = lerp4(c01, c11, tx);
  const out = lerp4(top, bot, ty);
  return out as [number, number, number, number];
}

function px(arr: Uint8ClampedArray, w: number, x: number, y: number): [number, number, number, number] {
  const i = (y * w + x) * 4;
  return [arr[i], arr[i + 1], arr[i + 2], arr[i + 3]];
}
function lerp4(a: number[], b: number[], t: number): number[] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t
  ];
}

function clampI(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }



export {
    MaterialUtil
}