import { UrlPic, FilePic, NoPic } from "./UploadData";

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

export type CompleteMusic = {
	isUrl: boolean,
	hash: number,
	path: string,
	stream: false,
	title: string,
	ytId?: string,
} | {
	isUrl: boolean,
	hash: undefined,
	path: string,
	stream: true,
	title: string,
	ytId?: string,
}

export interface CompleteUrlPic extends UrlPic {
	hash: number;
	title: string;
};

export interface CompleteFilePic extends FilePic {
	hash: number;
};

export interface CompleteNoPic extends NoPic {
	hash: undefined;
}

export type CompletePicture = CompleteUrlPic | CompleteFilePic | CompleteNoPic;
