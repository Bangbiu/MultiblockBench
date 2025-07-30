import { DoubleSide, LineBasicMaterial, MeshBasicMaterial, PointsMaterial } from "three";

const config = {
    referer: {
        face_mat: new MeshBasicMaterial({
            color: "#ffff00", 
            side: DoubleSide,
            transparent: true,
            opacity: 0.5
        }),

        edge_mat: new LineBasicMaterial({ 
            color: 0xFF00FF 
        }),

        vert_mat: new PointsMaterial({
            color: 0xff44aa,
            size: 0.1,
            sizeAttenuation: true,
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
    }
}

declare global {
    interface Window {
        config: typeof config;
    }
}

export function bootstrap() {
    window.config = config;
}