export interface PublicItemData {
    musicDownloadUrl?: string;
    duration: number;
    id: number;
    nickname: string;
    title: string;
    userId: string;
    image?: {
        url: string | undefined;
        title: string;
    }
}
