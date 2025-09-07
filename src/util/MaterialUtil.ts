import { 
    BufferAttribute, 
    DoubleSide, 
    FrontSide, 
    Texture, 
    Vector2, 
    Vector3, 
    type Material 
} from "three";
import type { Coplane } from "../geometry/SubGeometries";

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

export {
    MaterialUtil
}