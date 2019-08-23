export interface ItemData {
    id: number;
    userId: string;
    music: {
        isUrl: boolean | null,
        hash?: string,
        path: string,
        stream: boolean,
        title: string,
        ytId?: string,
    };
    pic: PicData;
    duration: number;
    startTime: string | null;
    endTime: string | null;
    timePlayedAt?: number;
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
