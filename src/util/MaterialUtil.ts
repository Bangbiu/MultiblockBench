import { DoubleSide, FrontSide, type Material } from "three";



class MaterialUtil {
    public static setMaterialOpacity(material: Material | Array<Material>, opacity: number): void {
        const mats = Array.isArray(material) ? material : [material];
        mats.forEach(mat => {
            mat.transparent = (opacity !== 1);
            mat.opacity = opacity;
            mat.side = opacity === 1 ? FrontSide : DoubleSide;  // Optional: see both side
        });
    }
}

export {
    MaterialUtil
}