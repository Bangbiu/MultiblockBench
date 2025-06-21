import { LoadingManager, Group } from "three";
import { MTLLoader, OBJLoader, type MaterialCreator } from "three-stdlib";

type OptFile = File | undefined;
type ArrangedFiles = [File, OptFile, ...File[]]

class FileUtil {
    public static readonly OBJ_EXT: string = 'obj';
    public static readonly MTL_EXT: string = 'mtl';

    public static getFileExtension(file: File): string {
        const parts = file.name.split('.');
        return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
    }

    public static arrangeObjMtl(fileList: FileList | null): ArrangedFiles | undefined {
        if (!fileList) return undefined;
        let fileArr = [...fileList];
        let objFile: OptFile = undefined;
        let mtlFile: OptFile = undefined; 
        fileArr = fileArr.filter(
            file => {
                if (FileUtil.OBJ_EXT == FileUtil.getFileExtension(file)) {
                    objFile = file;
                    return false;
                } else if (FileUtil.MTL_EXT == FileUtil.getFileExtension(file)) {
                    mtlFile = file;
                    return false;
                } else {
                    return true;
                }
            }
        );
        if (!objFile) return undefined;
        return [objFile, mtlFile, ...fileArr];
    }

    public static async loadObj(fileList: ArrangedFiles): Promise<Group> {
        const objFile: File = fileList[0];
        const mtlFile: OptFile = fileList[1]; 
        const textureFiles: Array<File> = fileList.slice(2) as Array<File>;
        const manager = new LoadingManager();
        const objLoader = new OBJLoader(manager);
        console.log(fileList);
        
        if (mtlFile) {
            // Found Material File
            console.log("Referenced MTL file:", mtlFile.name);
            // Convert File objects to Object URLs
            const objURL = URL.createObjectURL(objFile);
            const mtlURL = URL.createObjectURL(mtlFile);

            // Setup fake file system mapping for textures
            const textureMap = new Map<string, string>();
            for (const tex of textureFiles) {
                const texURL = URL.createObjectURL(tex);
                textureMap.set(tex.name, texURL);
            }

            // Intercept texture loading
            manager.setURLModifier((url) => {
                const fileName = url.split('/').pop()!;
                return textureMap.get(fileName) || url;
            });

            const mtlLoader = new MTLLoader(manager);
            mtlLoader.setResourcePath('./');
            const materials = await new Promise<MaterialCreator>((resolve, reject) => {
                mtlLoader.load(mtlURL, resolve, undefined, reject);
            });
            materials.preload();
            objLoader.setMaterials(materials);

            const object = await new Promise<Group>((resolve, reject) => {
                objLoader.load(objURL, resolve, undefined, reject);
            });

            // Clean up URLs after loading
            URL.revokeObjectURL(mtlURL);
            URL.revokeObjectURL(objURL);
            for (const url of textureMap.values()) {
                URL.revokeObjectURL(url);
            }

            object.scale.set(16, 16, 16);
            return object;
        } else {
            console.log("No mtllib reference found in the OBJ file.");
            const objText = await FileUtil.readFileAsText(objFile);
            const loadedObj = objLoader.parse(objText);
            // Resize to Fit Grid
            loadedObj.scale.set(16, 16, 16);
            return loadedObj;
        }
    }

    public static readFileAsText(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
          resolve(reader.result as string);
        };
    
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
}

export {
    FileUtil
}

export type {
    ArrangedFiles,
    OptFile
}

