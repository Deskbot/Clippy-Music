type StartOptions = {
	before?: (value: string) => string // Runs before node-prompt callbacks. It modifies user's input
	default?: string,				  // Default value to use if no value is entered.
	description?: string,			  // Prompt displayed to the user. If not supplied name will be used.
	hidden?: boolean,				  // If true, characters entered will either not be output to console or will be outputed using the `replace` string.
	message?: string,				  // Warning message to display if validation fails.
	noHandleSIGINT?: boolean,		  // This module will not handle SIGINT, if true
	pattern?: RegExp,				  // Regular expression that input must be valid against.
	replace?: string,				  // If `hidden` is set it will replace each hidden character with the specified string.
	required?: boolean,				// If true, value entered must be non-empty.
	type?: string,					 // Specify the type of input to expect.
};

type GetArrayOptions = {
	name: string,
	hidden?: boolean,
	message?: string,
	required?: boolean,
	conform?: (value: string) => boolean,
}[];

type GetObjectOptions = {
	properties: {
		[property: string]: {
			hidden: boolean,
			message: string,
			pattern: RegExp,
			required: boolean,
		}
	}
};

type PromptResultHandler = (err: any, result: { [property: string]: string; }) => void;

type PromptApi = {
	colors: boolean,
	message: string,
	delimiter: string,
	get(options: GetObjectOptions | GetArrayOptions, resultHandler: PromptResultHandler): void,
	start(options: StartOptions): void,
}

declare module "prompt" {
	let api: PromptApi;

	export = api;
}
