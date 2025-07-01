type TransparentColor = [string, number]

interface Config {
    selection: {
        faceColor: TransparentColor,
        coplaneColor: TransparentColor
    },
    grid: {
        blockColor: string,
        unitColor: string,
        originPlaneColor: TransparentColor
    },
    model: {
        wireframeColor: string
        wireframeLineWidth: number
    }
}

declare global {
    interface Window {
        config: Config;
    }
}

async function bootstrap() {
    try {
        const config = await loadRuntimeConfig();
        console.log("Runtime config:", config);
        window.config = config;
    } catch (err) {
        console.error("Failed to load runtime config:", err);
    }
}

async function loadRuntimeConfig(): Promise<Config> {
    const res = await fetch('public/config.json');
    if (!res.ok) throw new Error("Failed to load runtime config");
    return await res.json();
}

export type {
    Config
}

export {
    bootstrap
}