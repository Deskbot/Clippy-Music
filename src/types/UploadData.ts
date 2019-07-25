export interface UploadData {
    id?: number;
    userId?: string;
    music: {
        isUrl: boolean | null,
        title: string | null,
        path: string | null,
        stream: boolean,
    },
    pic: {
        exists: boolean,
        isUrl: boolean | null,
        title: string | null,
        path: string | null,
    },
    duration: number | null,
    startTime: string | null,
    endTime: string | null,
};
