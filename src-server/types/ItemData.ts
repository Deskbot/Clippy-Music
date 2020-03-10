import { UrlImage, FileImage, NoImage } from "./UploadData";

export interface ItemData {
	id: number;
	userId: string;
	music: CompleteMusic;
	overlay: CompleteImage;
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
	stream: true,
	title: string,
	uniqueId: string;
	url: string;
} | {
	isUrl: true,
	hash: number,
	path: string,
	stream: false,
	title: string,
	uniqueId: string;
	url: string;
}

export interface CompleteUrlImg extends UrlImage {
	hash: number;
	path: string;
	title: string;
};

export interface CompleteFileImg extends FileImage {
	hash: number;
};

export interface CompleteNoImg extends NoImage {
	hash: undefined;
}

export type CompleteImage = CompleteUrlImg | CompleteFileImg | CompleteNoImg;
