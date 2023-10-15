/* eslint-disable @typescript-eslint/naming-convention */
import fs from "node:fs";
import path from "node:path";
import { inject, injectable } from "tsyringe";
import { CompilerOptions, ModuleKind, ModuleResolutionKind, ScriptTarget, TranspileOptions, transpileModule } from "typescript";
import type { ILogger } from "../models/spt/utils/ILogger";
import { VFS } from "../utils/VFS";
import { HashCacheService } from "./HashCacheService";

@injectable()
export class ModCompilerService
{
    protected serverDependencies: string[];

    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("HashCacheService") protected hashCacheService: HashCacheService,
        @inject("VFS") protected vfs: VFS
    )
    {
        const packageJsonPath: string = path.join(__dirname, "../../package.json");
        this.serverDependencies = Object.keys(JSON.parse(this.vfs.readFile(packageJsonPath)).dependencies);
    }

    /**
     * Convert a mods TS into JS
     * @param modName Name of mod
     * @param modPath Dir path to mod
     * @param modTypeScriptFiles 
     * @returns 
     */
    public async compileMod(modName: string, modPath: string, modTypeScriptFiles: string[]): Promise<void>
    {
        // Concatenate TS files into one string
        let tsFileContents: string;
        let fileExists = true; // does every js file exist (been compiled before)
        for (const file of modTypeScriptFiles)
        {
            const fileContent = this.vfs.readFile(file);
            tsFileContents+= fileContent;

            // Does equivalent .js file exist
            if (!this.vfs.exists(file.replace(".ts", ".js")))
            {
                fileExists = false;
            }
        }

        const hashMatches = this.hashCacheService.modContentMatchesStoredHash(modName, tsFileContents);

        if (fileExists && hashMatches)
        {
            // Everything exists and matches, escape early
            return;
        }

        if (!hashMatches)
        {
            // Store / update hash in json file
            this.hashCacheService.storeModContent(modName, tsFileContents);
        }

        return this.compile(modTypeScriptFiles,
            {
                noEmitOnError: true,
                noImplicitAny: false,
                target: ScriptTarget.ES2022,
                module: ModuleKind.CommonJS,
                moduleResolution: ModuleResolutionKind.Node10,
                inlineSourceMap: true,
                resolveJsonModule: true,
                allowJs: true,
                esModuleInterop: true,
                downlevelIteration: true,
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                rootDir: modPath,
                isolatedModules: true
            });
    }

    /**
     * Convert a TS file into JS
     * @param fileNames Paths to TS files
     * @param options Compiler options
     */
    protected async compile(fileNames: string[], options: CompilerOptions): Promise<void>
    {
        const tranOptions: TranspileOptions = {
            compilerOptions: options
        };

        for (const filePath of fileNames)
        {
            const readFile = fs.readFileSync(filePath);
            const text = readFile.toString();

            let replacedText: string;
            if (globalThis.G_RELEASE_CONFIGURATION)
            {
                // C:/snapshot/project || /snapshot/project
                const baseDir: string = __dirname.replace(/\\/g,"/").split("/").slice(0, 3).join("/");
                replacedText = text.replace(/(@spt-aki)/g, `${baseDir}/obj`);
                for (const dependency of this.serverDependencies) 
                {
                    replacedText = replacedText.replace(`"${dependency}"`, `"${baseDir}/node_modules/${dependency}"`);
                }
            }
            else
            {
                replacedText = text.replace(/(@spt-aki)/g, path.join(__dirname, "..").replace(/\\/g,"/"));
            }

            const output = transpileModule(replacedText, tranOptions);
            fs.writeFileSync(filePath.replace(".ts", ".js"), output.outputText);
        }

        while (!this.areFilesReady(fileNames))
        {
            await this.delay(200);
        }
    }

    /**
     * Do the files at the provided paths exist
     * @param fileNames 
     * @returns 
     */
    protected areFilesReady(fileNames: string[]): boolean
    {
        return fileNames.filter(x => !this.vfs.exists(x.replace(".ts", ".js"))).length === 0;
    }

    /**
     * Wait the provided number of milliseconds
     * @param ms Milliseconds
     * @returns 
     */
    protected delay(ms: number): Promise<unknown>
    {
        return new Promise( resolve => setTimeout(resolve, ms) );
    }
}