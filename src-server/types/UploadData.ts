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
    isUrl: true;
    path: string;
    title?: string;
}

export interface FilePic {
    exists: true;
    isUrl: false;
    path: string;
    title: string;
}

export interface NoPic {
    exists: false;
    isUrl: null;
    path: null;
    title: null;
}

export interface UploadDataWithId extends UploadData {
    id: number;
    userId: string;
}

export interface UploadDataWithIdTitleDuration extends UploadDataWithId {
    duration: number;
    music: TitledMusic;
}

export type TitledMusic = (UrlMusic | FileMusic) & {
    title: string,
};
