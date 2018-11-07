import * as cp from 'cpy';
import { FsLocal } from './FsLocal';
import { FsGeneric } from './FsGeneric';
import { FsFtp } from './FsFtp';
import { observable, action, runInAction, autorun } from 'mobx';
import { ObservableArray } from 'mobx/lib/types/observablearray';

export interface File {
    dir: string;
    name: string;
    fullname: string;
    extension: string;
    cDate: Date;
    mDate: Date;
    length: number;
    mode: number;
    isDir: boolean;
    readonly: boolean;
}

export interface Fs {
    // runtime api
    API: (new (path:string) => FsApi);
    // static members
    canread(str: string): boolean;
    serverpart(str: string): string;
    name: string;
    description: string;
}

export class Directory {
    /* observable properties start here */
    @observable
    path: string = '';

    readonly files = observable<File>([]);

    readonly selected = observable<File>([]);

    @observable
    server: string = '';

    @observable
    status: 'blank' | 'busy' | 'ok' | 'login';

    @observable
    type: string;

    /* fs API */
    private api: FsApi;
    private fs: Fs;

    constructor(path: string) {
        this.path = path;
        this.getFS(path);

        // setTimeout(() => {
        //     console.log('settimeout: modifying element');
        //     runInAction(() => {
        //         this.files[0].fullname = 'dtc !!**';
        //     })
        // }, 5000);
    }

    private getFS(path: string): void{
        let newfs = interfaces.find((filesystem) => filesystem.canread(path));

        if (!newfs) {
             newfs = FsGeneric;
        }

        this.fs = newfs;
        this.api = new newfs.API(path);
    }

    @action
    // changes current path and retrieves file list
    cd(path: string, path2: string = '') {
        // first updates fs (eg. was local fs, is now ftp)
        if (this.path.substr(0, 1) !== path.substr(0, 1)) {
            this.getFS(path);
            this.server = this.fs.serverpart(path);
        }

        // then attempt to read directory ?
        if (!this.api.isConnected()) {
            this.status = 'login';
        } else {
            const joint = path2 ? this.api.join(path, path2) : path;
            return this.api.cd(joint)
                .then((path) => {
                    this.path = path;
                    return this.api.list(path);
                })
                .then((files: File[]) => {
                    runInAction(() => {
                        console.log('run in actions', this.path);
                        this.files.replace(files);
                    });
                });
        }
    }

    reload() {
        this.cd(this.path);
    }

    join(path: string, path2: string) {
        return this.api.join(path, path2);
    }

    rename(source: string, file: File, newName: string): Promise<string> {
        return this.api.rename(source, file, newName);
    }

    exists(path: string): Promise<boolean> {
        return this.api.exists(path);
    }

    makedir(parent: string, dirName: string): Promise<string> {
        return this.api.makedir(parent, dirName);
    }

    delete(source: string, files: File[]): Promise<number> {
        return this.api.delete(source, files);
    }

    copy(source: string, files: string[], dest: string): Promise<number> & cp.ProgressEmitter {
        return this.api.copy(source, files, dest);
    }

    isDirectoryNameValid = (dirName:string) => {
        return this.api.isDirectoryNameValid(dirName);
    }

    size(source: string, files: string[]): Promise<number> {
        return this.api.size(source, files);
    }
}

export interface FsApi {
    // public API
    list(dir: string): Promise<File[]>;
    cd(path:string): Promise<string>;
    delete(parent: string, files: File[]): Promise<number>;
    copy(parent: string, files: string[], dest: string): Promise<number> & cp.ProgressEmitter;
    join(...paths: string[]): string;
    makedir(parent: string, name: string): Promise<string>;
    rename(parent: string, file: File, name: string): Promise<string>;
    exists(path: string): Promise<boolean>;
    resolve(path: string): string;
    size(source: string, files: string[]): Promise<number>;
    isConnected(): boolean;
    isDirectoryNameValid(dirName: string): boolean;
}

const interfaces: Array<Fs> = new Array();

export function registerFs(fs: Fs): void {
    console.log('Registring Fs', fs.name);
    interfaces.push(fs);
};

registerFs(FsLocal);
registerFs(FsFtp);
registerFs(FsGeneric);