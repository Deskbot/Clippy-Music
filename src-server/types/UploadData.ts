export interface UploadData {
    duration?: number;
    id?: number;
    userId?: string;
    music: UrlMusic | FileMusic;
    pic: UrlPic | FilePic | NoPic;
    startTime: number | null;
    endTime: number | null;
};

export interface UrlMusic {
    isUrl: true;
    path: string;
    title?: string;
    ytId?: string;
}

export interface FileMusic {
    isUrl: false;
    path: string;
    title: string;
}

export interface UrlPic {
    exists: true;
    hash?: number;
    isUrl: true;
    path: string;
    title?: string;
}

export interface FilePic {
    exists: true;
    hash?: number;
    isUrl: false;
    path: string;
    title: string;
}

export interface NoPic {
    exists: false;
    hash?: number;
    isUrl: null;
    path: null;
    title: null;
}

export interface UploadDataWithId extends UploadData {
    id: number;
}

export interface UploadDataWithIdAndTitle extends UploadDataWithId {
    music: UploadDataWithId["music"] & {
        title: string;
    }
}
