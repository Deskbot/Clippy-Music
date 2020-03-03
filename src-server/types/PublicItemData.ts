export interface PublicItemData {
    musicDownloadLink?: string;
    imageDownloadLink?: string;
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
