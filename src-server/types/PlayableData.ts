export interface PlayableData {
    id: number;
    userId: string;
    music: MusicData;
    pic: PicData;
    duration: number;
    startTime: string | null;
    endTime: string | null;
    timePlayedAt?: number;
};

type MusicData = {
    isUrl: boolean | null,
    hash: string,
    path: string | null,
    stream: boolean,
    title: string,
    ytId?: string,
};

type PicData = {
    exists: true,
    hash?: number,
    isUrl: boolean,
    title: string,
    path: string,
} | {
    exists: false,
    hash?: string,
    isUrl: boolean | null,
    title: null,
    path: null,
};
