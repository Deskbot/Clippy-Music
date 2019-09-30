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
	isUrl: false,
	hash: number,
	path: string,
	stream: false,
	title: string,
} | {
	isUrl: true,
	hash: undefined,
	path: string,
	stream: true,
	title: string,
	uniqueId: string;
} | {
	isUrl: true,
	hash: number,
	path: string,
	stream: false,
	title: string,
	uniqueId: string;
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
