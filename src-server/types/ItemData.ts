export interface ItemData {
    id: number;
    userId: string;
    music: CompleteMusic;
    pic: CompletePicture;
    duration: number;
    startTime: number | null;
    endTime: number | null;
    timePlayedAt?: number;
};

export type CompletePicture = {
    exists: true,
    hash?: number,
    isUrl: boolean,
    title: string,
    path: string,
} | {
    exists: false,
    hash?: string,
    isUrl: boolean,
    title: null,
    path: null,
};

export interface CompleteMusic {
    isUrl: boolean,
    hash: number,
    path: string,
    stream: boolean,
    title: string,
    ytId?: string,
}