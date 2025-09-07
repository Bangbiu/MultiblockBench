import { DoubleSide, LineBasicMaterial, MeshBasicMaterial, PointsMaterial, Vector3 } from "three";

const config = {
    referer: {
        face_mat: new MeshBasicMaterial({
            color: "#ffff00", 
            side: DoubleSide,
            transparent: true,
            opacity: 0.5
        }),

        edge_mat: new LineBasicMaterial({ 
            color: 0xFF00FF,
            depthTest: false,
            depthWrite: false
        }),

        vert_mat: new PointsMaterial({
            color: 0xff44aa,
            size: 0.1,
            sizeAttenuation: true,
            depthTest: false,
            depthWrite: false
        })
    },
    grid: {
        block_color: "#FFFFFF",
        unit_color: "#AAAAAA",
        origin_plane_mat: new MeshBasicMaterial({
            color: "#ffffff",
            transparent: true,
            opacity: 0.1, // make it faint
            side: DoubleSide
        })
    },
    model: {
        wireframe_mat: new LineBasicMaterial({
            color: "#EEEEEE",
            linewidth: 1
        })
    },
    scale: new Vector3(16, 16, 16)
}

declare global {
    interface Window {
        config: typeof config;
    }
}

export function bootstrap() {
    window.config = config;
}